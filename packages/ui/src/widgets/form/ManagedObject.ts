import type { JSONSchema, JSONSchemaArray, JSONSchemaObject, JSONSchemaType } from "@vertesia/common";
import { ArrayPropertySchema, PropertySchema, Schema } from "./schema.js";

export function computeTitleFromName(name: string) {
    name = name.replace(/_/g, ' ').replace(/([a-z0-9])&([A-Z])/g, "$1 $2");
    return name[0].toUpperCase() + name.slice(1);
}

function getInputType(_name: string, schema: PropertySchema) {
    if (schema.editor) {
        return schema.editor;
    }
    // Check for enum constraint
    if (schema.enum?.length) {
        return 'enum';
    }
    // Check format as fallback (e.g., "document", "media", "date", etc.)
    if (schema.schema.format) {
        return schema.schema.format;
    }
    switch (schema.type) {
        case 'number':
        case 'integer':
            return 'number';
        case 'boolean':
            return 'checkbox';
        case 'string':
            return "text";
        default:
            return 'text';
    }
}


export abstract class Node<SchemaT extends Schema = Schema, ValueT = JSONSchemaType> {
    // change observer
    observer?: (node: Node) => void | false; // return false to stop bubbling

    abstract value: ValueT;

    constructor(public parent: Node | null, public schema: SchemaT, public name: string) {
    }

    get isRoot() {
        return !this.parent;
    }

    get root(): Node {
        return this.parent ? this.parent.root : this as Node;
    }

    get path(): string[] {
        return this.parent ? this.parent.path.concat(this.name) : [];
    }

    get isScalar() {
        return false;
    }

    get isListItem(): boolean {
        return false;
    }

    get isObject() {
        return false;
    }

    get isList() {
        return false;
    }

    get title() {
        return this.schema.title || computeTitleFromName(this.name);
    }

    protected onChange(node: Node) {
        if (this.observer) {
            if (this.observer(this as Node) === false) {
                return;
            };
        }
        this.parent && this.parent.onChange(node);
    }


}

export abstract class ManagedObjectBase<SchemaT extends Schema = Schema> extends Node<SchemaT, JSONSchemaObject> {
    abstract value: JSONSchemaObject;

    constructor(parent: Node | null, schema: SchemaT, name: string) {
        super(parent, schema, name);
    }

    get isObject(): boolean {
        return true;
    }

    getProperty(name: string) {
        const schema = this.schema.properties[name];
        if (schema.isMulti) {
            if (schema.enum?.length) {
                // Enum arrays are multi-select scalars, not managed lists
                this.getOrInitArrayProperty(name);
                return new ManagedProperty(this, schema);
            }
            return new ManagedListProperty(this, schema as ArrayPropertySchema, this.getOrInitArrayProperty(name));
        } else if (schema.isObject) {
            return new ManagedObjectProperty(this, schema, schema.name, this.getOrInitObjectProperty(name));
        } else {
            return new ManagedProperty(this, schema);
        }
    }

    getOrInitObjectProperty(name: string): JSONSchemaObject {
        let value = this.value[name];
        if (!value) {
            this.value[name] = value = {};
        }
        return value as JSONSchemaObject;
    }

    getOrInitArrayProperty(name: string): JSONSchemaArray {
        let value = this.value[name];
        if (!value) {
            this.value[name] = value = [];
        }
        return value as JSONSchemaArray;
    }

    setPropertyValue(name: string, value: JSONSchemaType) {
        if (this.value[name] !== value) {
            this.value[name] = value;
            return true;
        }
        return false;
    }

    getPropertyValue(name: string) {
        return this.value[name];
    }

    get properties(): Node[] {
        const out: Node[] = [];
        for (const schema of Object.values(this.schema.properties)) {
            if (schema.isMulti) {
                if (schema.enum?.length) {
                    this.getOrInitArrayProperty(schema.name);
                    out.push(new ManagedProperty(this, schema));
                } else {
                    out.push(new ManagedListProperty(this, schema as ArrayPropertySchema, this.getOrInitArrayProperty(schema.name)));
                }
            } else if (schema.isObject) {
                out.push(new ManagedObjectProperty(this, schema, schema.name, this.getOrInitObjectProperty(schema.name)));
            } else {
                out.push(new ManagedProperty(this, schema));
            }
        }
        return out;
    }

    [Symbol.iterator]() {
        return this.properties[Symbol.iterator]();
    }

}

export class ManagedObject extends ManagedObjectBase<Schema> {

    constructor(schema: Schema | JSONSchema, public value: JSONSchemaObject = {}) {
        super(null, schema instanceof Schema ? schema : new Schema(schema), '#root');
    }

}

export class ManagedObjectProperty extends ManagedObjectBase<PropertySchema> {

    constructor(parent: Node, schema: PropertySchema, name: string, public value: JSONSchemaObject) {
        super(parent, schema, name);
    }

}


export class ManagedProperty extends Node<PropertySchema> {

    constructor(parent: ManagedObjectBase, schema: PropertySchema) {
        super(parent, schema, schema.name);
        if (parent.value[this.name] === undefined && schema.defaultValue !== undefined) {
            parent.value[this.name] = schema.defaultValue;
        }
    }

    get isScalar(): boolean {
        return true;
    }

    set value(value: JSONSchemaType) {
        const changed = (this.parent as ManagedObjectBase).setPropertyValue(this.name, value);
        if (changed) {
            this.onChange(this);
        }
    }

    get value() {
        return (this.parent as ManagedObjectBase).getPropertyValue(this.name);
    }

    getInputType() {
        return getInputType(this.name, this.schema);
    }

}

export class ManagedListProperty extends Node<ArrayPropertySchema, JSONSchemaArray> {

    items: MangedListItem[] = [];

    constructor(parent: ManagedObjectBase, schema: ArrayPropertySchema, public value: JSONSchemaArray) {
        super(parent, schema, schema.name);
        for (const _v of this.value) {
            this.add();
        }
    }

    get isList(): boolean {
        return true;
    }

    newItem(index: number) {
        if (this.schema.isObject) {
            return new ManageObjectEntry(this, index);
        } else {
            return new ManagedScalarEntry(this, index);
        }
    }

    add() {
        const item = this.newItem(this.items.length);
        this.items.push(item);
        return item;
    }

    //TODO change is fired even if the removed item is transient
    // how to mark an item as transient (an added item not yet set by the user)
    remove(index: number) {
        const value = this.value
        if (index >= 0 && index < this.items.length) {
            this.items.splice(index, 1);
            // update indexes
            for (let i = 0, l = this.items.length; i < l; i++) {
                const item = this.items[i];
                item.index = i;
                item.name = String(i);
            }
        }
        if (Array.isArray(value) && index >= 0 && index < value.length) {
            value.splice(index, 1);
            // TODO trigger onChange only if this item isn't transient
            this.onChange(this);
        }
    }

    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }

    item(index: number) {
        if (index < 0 || index >= this.value.length) {
            return undefined;
        }
        const item = this.value[index];
        if (this.schema.isObject) {
            return new ManagedObjectProperty(this, this.schema, String(index), item as JSONSchemaObject);
        } else {
            return new ManagedScalarEntry(this, index);
        }
    }

    /**
     * remove undefined items from the end of the list if any
     */
    trim() {
        while (this.items[this.items.length - 1] === undefined) {
            this.items.pop();
        }
    }

}

export class ManageObjectEntry extends ManagedObjectBase {

    key: string;

    constructor(parent: ManagedListProperty, public index: number) {
        super(parent, parent.schema, String(index));
        if (parent.value[index] === undefined) {
            parent.value[index] = {};
        }
        this.key = this.name + '@' + Date.now();
    }

    get isListItem(): boolean {
        return true;
    }

    set value(value: JSONSchemaObject) {
        (this.parent as ManagedListProperty).value[this.index] = value;
    }

    get value() {
        return (this.parent as ManagedListProperty).value[this.index] as JSONSchemaObject;
    }

}

export class ManagedScalarEntry extends Node<ArrayPropertySchema> {

    key: string;

    constructor(parent: ManagedListProperty, public index: number) {
        super(parent, parent.schema, String(index));
        if (parent.value[index] === undefined && parent.schema.defaultValue !== undefined) {
            parent.value[index] = parent.schema.defaultValue;
        }
        this.key = this.name + '@' + Date.now();
    }

    get isScalar(): boolean {
        return true;
    }

    get isListItem(): boolean {
        return true;
    }

    set value(value: JSONSchemaType) {
        (this.parent as ManagedListProperty).value[this.index] = value;
    }

    get value() {
        return (this.parent as ManagedListProperty).value[this.index];
    }

    getInputType() {
        return getInputType(this.name, this.schema);
    }

}

export type MangedListItem = ManagedScalarEntry | ManageObjectEntry;