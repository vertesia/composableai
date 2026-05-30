export type ObjectKey = string | number | undefined;
export interface ObjectVisitor {
    onStartObject?: (key: ObjectKey, value: Record<string, unknown>) => void;
    onEndObject?: (key: ObjectKey, value: Record<string, unknown>) => void;
    onStartIteration?: (key: ObjectKey, value: Iterable<unknown>) => void;
    onEndIteration?: (key: ObjectKey, value: Iterable<unknown>) => void;
    onValue?: (key: ObjectKey, value: unknown) => void;
}

export interface AsyncObjectVisitor {
    onStartObject?: (key: ObjectKey, value: Record<string, unknown>) => Promise<void>;
    onEndObject?: (key: ObjectKey, value: Record<string, unknown>) => Promise<void>;
    onStartIteration?: (key: ObjectKey, value: Iterable<unknown>) => Promise<void>;
    onEndIteration?: (key: ObjectKey, value: Iterable<unknown>) => Promise<void>;
    onValue?: (key: ObjectKey, value: unknown) => Promise<void>;
}

type MutableContainer = Record<string | number, unknown> | unknown[];

function isIterable(value: unknown): value is Iterable<unknown> {
    return value !== null && typeof value === 'object' && Symbol.iterator in value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
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

    map(obj: unknown, mapFn: (key: ObjectKey, value: unknown) => unknown): unknown {
        const visitor = new MapVisitor(mapFn);
        this.walk(obj, visitor);
        return visitor.result;
    }
}

export class AsyncObjectWalker {
    supportIterators = false; // only array are supported by default
    constructor(supportIterators = false) {
        this.supportIterators = supportIterators;
    }
    async walk(obj: unknown, visitor: AsyncObjectVisitor) {
        await this._walk(undefined, obj, visitor);
    }
    async _walk(key: ObjectKey, obj: unknown, visitor: AsyncObjectVisitor) {
        const type = typeof obj;
        if (!obj || type !== 'object' || obj instanceof Date) {
            await visitor.onValue?.(key, obj);
        } else if (Array.isArray(obj)) {
            await this._walkIterable(key, obj, visitor);
        } else if (this.supportIterators && isIterable(obj)) {
            await this._walkIterable(key, obj, visitor);
        } else if (isPlainRecord(obj)) {
            // a plain object
            await this._walkObject(key, obj, visitor);
        } else {
            // a random object - we treat it as a value
            await visitor.onValue?.(key, obj);
        }
    }

    async _walkIterable(key: ObjectKey, obj: Iterable<unknown>, visitor: AsyncObjectVisitor) {
        await visitor.onStartIteration?.(key, obj);
        let i = 0;
        for (const value of obj) {
            await this._walk(i++, value, visitor);
        }
        await visitor.onEndIteration?.(key, obj);
    }

    async _walkObject(key: ObjectKey, obj: Record<string, unknown>, visitor: AsyncObjectVisitor) {
        await visitor.onStartObject?.(key, obj);
        for (const k of Object.keys(obj)) {
            await this._walk(k, obj[k], visitor);
        }
        await visitor.onEndObject?.(key, obj);
    }

    async map(obj: unknown, mapFn: (key: ObjectKey, value: unknown) => Promise<unknown>): Promise<unknown> {
        const visitor = new AsyncMapVisitor(mapFn);
        await this.walk(obj, visitor);
        return visitor.result;
    }
}

class MapVisitor implements ObjectVisitor {
    result: unknown;
    current: MutableContainer | undefined;
    stack: MutableContainer[] = [];
    constructor(private mapFn: (key: ObjectKey, value: unknown) => unknown) {}

    private setValue(key: ObjectKey, value: unknown) {
        if (key === undefined) {
            this.result = value;
        } else if (this.current) {
            if (Array.isArray(this.current) && typeof key === 'number') {
                this.current[key] = value;
            } else if (!Array.isArray(this.current)) {
                this.current[key] = value;
            }
        }
    }

    onStartObject(key: ObjectKey) {
        const obj: Record<string, unknown> = {};
        if (key === undefined) {
            this.result = obj;
            this.current = obj;
        } else {
            if (this.current) {
                this.stack.push(this.current);
            }
            this.setValue(key, obj);
            this.current = obj;
        }
    }
    onEndObject() {
        this.current = this.stack.pop();
    }

    onStartIteration(key: ObjectKey) {
        const ar: unknown[] = [];
        if (key === undefined) {
            this.result = ar;
            this.current = ar;
        } else {
            if (this.current) {
                this.stack.push(this.current);
            }
            this.setValue(key, ar);
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
            this.setValue(key, r);
        }
    }
}

class AsyncMapVisitor implements AsyncObjectVisitor {
    result: unknown;
    current: MutableContainer | undefined;
    stack: MutableContainer[] = [];
    constructor(private mapFn: (key: ObjectKey, value: unknown) => Promise<unknown>) {}

    private setValue(key: ObjectKey, value: unknown) {
        if (key === undefined) {
            this.result = value;
        } else if (this.current) {
            if (Array.isArray(this.current) && typeof key === 'number') {
                this.current[key] = value;
            } else if (!Array.isArray(this.current)) {
                this.current[key] = value;
            }
        }
    }

    async onStartObject(key: ObjectKey) {
        const obj: Record<string, unknown> = {};
        if (key === undefined) {
            this.result = obj;
            this.current = obj;
        } else {
            if (this.current) {
                this.stack.push(this.current);
            }
            this.setValue(key, obj);
            this.current = obj;
        }
    }
    async onEndObject() {
        this.current = this.stack.pop();
    }

    async onStartIteration(key: ObjectKey) {
        const ar: unknown[] = [];
        if (key === undefined) {
            this.result = ar;
            this.current = ar;
        } else {
            if (this.current) {
                this.stack.push(this.current);
            }
            this.setValue(key, ar);
            this.current = ar;
        }
    }

    async onEndIteration() {
        this.current = this.stack.pop();
    }

    async onValue(key: ObjectKey, value: unknown) {
        const r = await this.mapFn(key, value);
        if (key === undefined) {
            this.result = r;
        } else if (r !== undefined) {
            this.setValue(key, r);
        }
    }
}
