import React, { ReactNode, useContext, useEffect, useState } from "react";

//type KeysOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
//type KeysNotOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? never : K }[keyof T];

export class Property<V = any> {
    _value?: V;
    watchers: ((value: V) => void)[] = [];
    constructor(value?: V) {
        this._value = value;
    }

    get value() {
        return this._value;
    }

    set value(value: any) {
        if (value !== this._value) {
            this._value = value;
            for (const watcher of this.watchers) {
                watcher(value);
            }
        }
    }

    watch(watcher: (value: any) => void) {
        this.watchers.push(watcher);
        return () => {
            this.watchers = this.watchers.filter(w => w !== watcher);
        }
    }
}

interface ContextContainer<T> {
    Context: React.Context<T>
}

type ConstructorOf<T = any> = new (...args: any[]) => T;
export function createCompositeStateProvider<T>(StateClass: ConstructorOf<T>) {
    const context = React.createContext<T>(undefined as any);
    (StateClass as unknown as ContextContainer<T>).Context = context;
    return context.Provider;
}


export class Slot {

    private consume: ((content: ReactNode) => void) | undefined = undefined
    private _current: ReactNode;

    constructor(content?: ReactNode) {
        this._current = content;
    }

    set current(content: ReactNode) {
        if (content !== this._current) {
            this._current = content;
            this.consume?.(content);
        }
    }

    get current() {
        return this._current;
    }

    withConsumer(consume: ((content: ReactNode) => void) | undefined) {
        this.consume = consume;
        consume && consume(this.current);
        return this;
    }
}


export function useCompositeState<T>(StateClass: ConstructorOf<T>) {
    const context = (StateClass as unknown as ContextContainer<T>).Context;
    if (!context) {
        throw new Error("Context not defined for " + StateClass.name);
    }
    return useContext(context);
}

export function useGetCompositeStateProperty<V>(property: Property<V>) {
    const [value, setValue] = useState(property.value)
    useEffect(() => {
        return property.watch((value) => {
            if (typeof value === 'function') {
                setValue(() => value) // cannot directly store functions
            } else {
                setValue(value)
            }
        });
    }, [property])
    return value as V;
}

// use memo on value to avoid re-computations if needed
export function useSetCompositeStateProperty<V>(property: Property<V>, value: V | undefined) {
    useEffect(() => {
        property.value = value;
        return () => {
            property.value = undefined;
        }
    }, [property, value])
    return value;
}

// use memo on watcher to avoid re-computations if needed
export function useWatchCompositeStateProperty<V>(property: Property<V>, watcher: (value: V | undefined) => void) {
    useEffect(() => {
        return property.watch(watcher);
    }, [property, watcher])
}

export function useSlot(slot: Slot) {
    const [value, setValue] = useState(slot.current)
    useEffect(() => {
        slot.withConsumer(setValue);
        return () => {
            slot.withConsumer(undefined);
        }
    }, [slot])
    return value;
}

export function useWatchSlot(slot: Slot, watcher: (value: ReactNode | undefined) => void) {
    useEffect(() => {
        slot.withConsumer(watcher);
        return () => {
            slot.withConsumer(undefined);
        }
    }, [slot, watcher])
}

// use memo for value if needed
export function useDefineSlot(slot: Slot, value: ReactNode | undefined) {
    useEffect(() => {
        slot.current = value;
        return () => {
            slot.current = undefined;
        }
    }, [slot, value])
}
