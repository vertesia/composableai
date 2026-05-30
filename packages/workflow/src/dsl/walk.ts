export type ObjectKey = string | number | undefined;
export interface ObjectVisitor {
    onStartObject?: (key: ObjectKey, value: unknown) => void;
    onEndObject?: (key: ObjectKey, value: unknown) => void;
    onStartIteration?: (key: ObjectKey, value: Iterable<unknown>) => void;
    onEndIteration?: (key: ObjectKey, value: Iterable<unknown>) => void;
    onValue?: (key: ObjectKey, value: unknown) => void;
}

type MutableContainer = Record<string, unknown> | unknown[];

function isIterable(value: unknown): value is Iterable<unknown> {
    return (
        !!value && typeof value === 'object' && Symbol.iterator in value && typeof value[Symbol.iterator] === 'function'
    );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && value.constructor === Object;
}

function setValue(target: MutableContainer | undefined, key: ObjectKey, value: unknown) {
    if (!target || key === undefined) {
        return;
    }
    if (Array.isArray(target) && typeof key === 'number') {
        target[key] = value;
    } else if (!Array.isArray(target) && typeof key === 'string') {
        target[key] = value;
    }
}

export class ObjectWalker {
    supportIterators = false; // only array are supported by default
    constructor(supportIterators = false) {
        this.supportIterators = supportIterators;
    }
    walk(obj: unknown, visitor: ObjectVisitor) {
        this._walk(undefined, obj, visitor);
    }
    _walk(key: ObjectKey, obj: unknown, visitor: ObjectVisitor) {
        const type = typeof obj;
        if (!obj || type !== 'object' || obj instanceof Date) {
            visitor.onValue?.(key, obj);
        } else if (Array.isArray(obj)) {
            this._walkIterable(key, obj, visitor);
        } else if (this.supportIterators && isIterable(obj)) {
            this._walkIterable(key, obj, visitor);
        } else if (isPlainRecord(obj)) {
            // a plain object
            this._walkObject(key, obj, visitor);
        } else {
            // a random object - we treat it as a value
            visitor.onValue?.(key, obj);
        }
    }

    _walkIterable(key: ObjectKey, obj: Iterable<unknown>, visitor: ObjectVisitor) {
        visitor.onStartIteration?.(key, obj);
        let i = 0;
        for (const value of obj) {
            this._walk(i++, value, visitor);
        }
        visitor.onEndIteration?.(key, obj);
    }

    _walkObject(key: ObjectKey, obj: Record<string, unknown>, visitor: ObjectVisitor) {
        visitor.onStartObject?.(key, obj);
        for (const k of Object.keys(obj)) {
            this._walk(k, obj[k], visitor);
        }
        visitor.onEndObject?.(key, obj);
    }

    map<T = unknown>(obj: unknown, mapFn: (key: ObjectKey, value: unknown) => unknown): T {
        const visitor = new MapVisitor(mapFn);
        this.walk(obj, visitor);
        return visitor.result as T;
    }
}

class MapVisitor implements ObjectVisitor {
    result: unknown;
    current: MutableContainer | undefined;
    stack: (MutableContainer | undefined)[] = [];
    constructor(private mapFn: (key: ObjectKey, value: unknown) => unknown) {}

    onStartObject(key: ObjectKey) {
        if (key === undefined) {
            const obj: Record<string, unknown> = {};
            this.result = obj;
            this.current = obj;
        } else {
            this.stack.push(this.current);
            const obj: Record<string, unknown> = {};
            setValue(this.current, key, obj);
            this.current = obj;
        }
    }
    onEndObject() {
        this.current = this.stack.pop();
    }

    onStartIteration(key: ObjectKey) {
        if (key === undefined) {
            const ar: unknown[] = [];
            this.result = ar;
            this.current = ar;
        } else {
            this.stack.push(this.current);
            const ar: unknown[] = [];
            setValue(this.current, key, ar);
            this.current = ar;
        }
    }

    onEndIteration() {
        this.current = this.stack.pop();
    }

    onValue(key: ObjectKey, value: unknown) {
        const r = this.mapFn(key, value);
        if (key === undefined) {
            this.result = r;
        } else if (r !== undefined) {
            setValue(this.current, key, r);
        }
    }
}
