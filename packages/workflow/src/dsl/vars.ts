import { ImportSpec } from "@vertesia/common";
import { matchCondition } from "./conditions.js";
import { ObjectKey, ObjectVisitor, ObjectWalker } from "./walk.js";

const FALLBACK_VALUE_SEP = "??";

function decodeLiteralValue(value: string) {
    if (value.startsWith("'") && value.endsWith("'")) {
        value = '"' + value.slice(1, -1).replace(/(?<!\\)"/g, '\\"') + '"'
    }
    return JSON.parse(value);
}

export function splitPath(path: string) {
    if (path.indexOf('[') > -1) { // support array like paths
        path = path.replace(/\[(\d+)\]/g, '.$1');
    }
    return path.split('.');
}

/**
 * Get the property named by "name" of the given object
 * If an array is idnexed using a string key then a map is done and an array with the content of the properties with that name are returned
 * Ex: docs.text => will return an array of text properties of the docs array
 * @param object the obejct
 * @param name the name of the property.
 * @returns the property value
 */
function _prop(object: any, name: string) {
    if (object === undefined) {
        return undefined;
    }
    object = _valueOf(object); // resolve Value objects
    if (Array.isArray(object)) {
        const index = +name;
        if (isNaN(index)) {
            // map array to property
            return object.map(item => item[name]);
        } else {
            return _valueOf(object[index]);
        }
    } else {
        return _valueOf(object[name]);
    }

}

function _valueOf(value: any) {
    return value instanceof Value ? value.value : value;
}

export function resolveField(object: any, path: string[]) {
    let p = object as any;
    if (!p) return p;
    if (!path.length) return _valueOf(p);
    const last = path.length - 1;
    for (let i = 0; i < last; i++) {
        p = _prop(p, path[i])
        if (!p) {
            return undefined;
        }
    }
    return _prop(p, path[last]);
}

abstract class Value<T = any> {
    abstract value: T;
    abstract stringify(): string;
}
class LiteralValue<T = any> extends Value<T> {
    constructor(public value: T) {
        super();
    }
    stringify() {
        return String(this.value);
    }
}

class RefValue extends Value {
    constructor(public vars: Vars, public path: string[], public defaultValue?: any) {
        super();
    }
    get value() {
        const v = this.vars.getValueFromPath(this.path);
        if (v === undefined) {
            if (this.defaultValue !== undefined) {
                return this.defaultValue;
            } else {
                return this.vars.preserveRefs ? this.stringify() : undefined;
            }
        } else {
            return v;
        }
    }

    stringify() {
        return "${" + this.path.join('.') + "}";
    }
}

class ExprValue extends Value {
    constructor(public vars: Vars, public parts: Value[]) {
        super();
    }
    get value() {
        const out: string[] = [];
        for (const seg of this.parts) {
            const v = seg.value;
            if (v !== undefined) {
                out.push(String(seg.value));
            }
        }
        return out.join('');
    }

    stringify() {
        const out = [];
        for (const seg of this.parts) {
            out.push(seg.stringify());
        }
        return "${" + out.join('') + "}";
    }

}


export class Vars {
    map: Record<string, any>;
    /**
     * This property is used when resolving params. It contains the list of references that should not be resolved to their value
     * but instead they need to return the string representation of the expression to eb able to regenrate another Vars instance with the same expression
     */
    //TODO this feature is no more used - it was replaced by importVars so we can now delete `preserveRefs`
    preserveRefs: Set<string> | undefined;

    constructor(vars?: Record<string, any>) {
        this.map = vars ? this.parse(vars) : {};
    }

    parse(vars: Record<string, any>): Record<string, any> {
        return new ObjectWalker().map(vars, (_key, value) => {
            if (typeof value === 'string') {
                return this.createValue(this, value);
            } else {
                return value;
            }
        });
    }

    load(vars: Record<string, any>) {
        const toAppend = this.parse(vars);
        this.map = Object.assign(this.map, toAppend);
        return this;
    }

    /**
     * Set a literal value (canboot set a ref)
     * To add refs use `append()`
     * @param name
     * @param value
     */
    setValue(name: string, value: any) {
        this.map[name] = value;
    }

    getValue(path: string) {
        return resolveField(this.map, splitPath(path));
    }

    getValueFromPath(path: string[]) {
        return resolveField(this.map, path);
    }

    has(name: string) {
        return this.map[name] !== undefined;
    }

    match(match: Record<string, any>) {
        for (const name of Object.keys(match)) {
            const value = this.getValue(name);
            if (!matchCondition(value, match[name])) {
                return false;
            }
        }
        return true;
    }

    resolveParams(params: Record<string, any>, preserveRefs?: Set<string>) {
        this.preserveRefs = preserveRefs;
        try {
            return new ObjectWalker().map(params, (_key, value) => {
                if (typeof value === 'string') {
                    const v = this.createValue(this, value)
                    return v instanceof Value ? v.value : v;
                } else {
                    return value;
                }
            });
        } finally {
            this.preserveRefs = undefined;
        }
    }

    resolve(preserveRefs?: Set<string>): Record<string, any> {
        function map(_key: ObjectKey, value: any) {
            if (value instanceof Value) {
                const v = value.value;
                if (v && typeof v === 'object') {
                    if (Array.isArray(v) || v.constructor === Object) {
                        // an array or plain object - recurse into the
                        // value to find other nested Ref values if any...
                        return new ObjectWalker().map(v, map);
                    }
                } else {
                    return v;
                }
            } else {
                return value
            }
        }
        try {
            this.preserveRefs = preserveRefs;
            return new ObjectWalker().map(this.map, map);
        } finally {
            this.preserveRefs = undefined;
        }
    }

    createRefValue(ref: string) {
        const index = ref.indexOf(FALLBACK_VALUE_SEP);
        let defaultValue: any;
        if (index > -1) {
            defaultValue = decodeLiteralValue(ref.substring(index + FALLBACK_VALUE_SEP.length).trim());
            ref = ref.substring(0, index).trim();
        }
        if (ref === '.' || ref.indexOf('..') > -1) {
            throw new Error("Invalid variable reference: " + ref)
        }
        return new RefValue(this, splitPath(ref), defaultValue);
    }

    createValue(vars: Vars, obj: any) {
        if (!obj) {
            return obj;
        }
        if (typeof obj === 'string') {
            if (obj.indexOf('${') > -1) {
                const segments = obj.split(/(\${[^}]+})/);
                if (segments.length === 1) {
                    const seg = segments[0];
                    return this.createRefValue(seg.substring(2, seg.length - 1));
                }
                const parts: Value[] = [];
                for (const seg of segments) {
                    if (seg === '') continue;
                    if (seg.startsWith('${') && seg.endsWith('}')) {
                        parts.push(this.createRefValue(seg.substring(2, seg.length - 1)));
                    } else {
                        parts.push(new LiteralValue(seg));
                    }
                }
                if (parts.length === 1) {
                    return parts[0];
                } else {
                    return new ExprValue(vars, parts);
                }
            } else {
                return obj;
            }
        } else {
            return obj;
        }
    }

    createImportVars(importSpec: ImportSpec | undefined) {
        if (!importSpec || importSpec.length === 0) {
            return {};
        }
        const result: Record<string, any> = {};

        for (const importVar of importSpec) {
            if (typeof importVar === "string") {
                addImportVar(importVar, undefined, this, result);
            } else {
                for (const key of Object.keys(importVar)) {
                    addImportVar(importVar[key], key, this, result);
                }
            }
        }
        return result;
    }

    getUnknownReferences(obj: any) {
        const visitor = new UnknownRefrencesVisitor(this);
        new ObjectWalker().walk(obj, visitor);
        return visitor.result;
    }
}

function addImportVar(varPath: string, asName: string | undefined, vars: Vars, result: Record<string, any>) {
    let isRequired = false;
    if (varPath.endsWith("!")) {
        isRequired = true;
        varPath = varPath.slice(0, -1);
    }
    let value = vars.getValue(varPath);
    if (value === undefined && isRequired) {
        throw new Error(`Import variable ${varPath} is required but not found`);
    }
    result[asName || varPath] = value;
}


class UnknownRefrencesVisitor implements ObjectVisitor {

    result: { name: string, expression: string }[] = [];

    constructor(public vars: Vars) {
    }

    onValue(_key: ObjectKey, value: any) {
        const vars = this.vars;
        if (typeof value === "string") {
            const v = vars.createValue(vars, value);
            if (v instanceof ExprValue) {
                for (const p of v.parts) {
                    if (p instanceof RefValue) {
                        if (!vars.has(p.path[0])) {
                            this.result.push({ name: p.path.join('.'), expression: p.stringify() });
                        }
                    }
                }
            } else if (v instanceof RefValue) {
                if (!vars.has(v.path[0])) {
                    this.result.push({ name: v.path.join('.'), expression: v.stringify() });
                }
            }
        }
    }
}
