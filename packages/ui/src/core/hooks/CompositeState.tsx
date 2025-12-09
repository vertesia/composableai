import React, { ReactNode, useContext, useEffect, useState } from "react";

//type KeysOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
//type KeysNotOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? never : K }[keyof T];

export class Property<V = any> {
    private _value?: V;
    private watchers: ((value: V | undefined) => void)[] = [];
    /**
     * Optional name for debugging purposes.
     * When provided, changes to this property will be logged to the console in development mode,
     * making it easier to track state changes and debug reactive updates.
     *
     * Example: new Property<string>('', 'streamingText')
     * Will log: [CompositeState] streamingText: "" → "new value"
     */
    readonly name?: string;

    constructor(value?: V, name?: string) {
        this._value = value;
        this.name = name;
    }

    get value() {
        return this._value;
    }

    set value(value: V | undefined) {
        if (value !== this._value) {
            this._value = value;
            for (const watcher of this.watchers) {
                watcher(value);
            }
        }
    }

    watch(watcher: (value: V | undefined) => void) {
        this.watchers.push(watcher);
        return () => {
            this.watchers = this.watchers.filter(w => w !== watcher);
        };
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

/**
 * Computed property that derives its value from other properties.
 * Automatically recalculates when any of its dependencies change.
 *
 * Think of it like a spreadsheet formula: if cell A1 = 5 and A2 = 10,
 * then A3 = A1 + A2 will automatically update to 15. If A1 changes to 7,
 * A3 automatically becomes 17.
 *
 * @example Basic usage
 * ```typescript
 * class MyState {
 *     count = new Property(0, 'count');
 *     multiplier = new Property(2, 'multiplier');
 *
 *     // Automatically recalculates when count or multiplier changes
 *     result = new ComputedProperty(
 *         () => (this.count.value || 0) * (this.multiplier.value || 0),
 *         [this.count, this.multiplier],
 *         'result'
 *     );
 * }
 *
 * state.count.value = 5;      // result automatically becomes 10
 * state.multiplier.value = 3; // result automatically becomes 15
 * ```
 *
 * @example Derived state
 * ```typescript
 * class EditorState {
 *     workingCopy = new Property<Interaction>();
 *     sourceInteraction = new Property<Interaction>();
 *
 *     // Automatically true when workingCopy differs from source
 *     isDirty = new ComputedProperty(
 *         () => JSON.stringify(this.workingCopy.value) !==
 *               JSON.stringify(this.sourceInteraction.value),
 *         [this.workingCopy, this.sourceInteraction],
 *         'isDirty'
 *     );
 * }
 * ```
 *
 * @example Cascading computed properties
 * ```typescript
 * class State {
 *     a = new Property(1);
 *     b = new Property(2);
 *     sum = new ComputedProperty(() => a.value + b.value, [a, b]);
 *     doubled = new ComputedProperty(() => sum.value * 2, [sum]);
 * }
 * ```
 *
 * Benefits:
 * - ✅ Automatic updates when dependencies change
 * - ✅ Memoization - only recalculates when needed
 * - ✅ Composable - can depend on other ComputedProperties
 * - ✅ Type-safe with full TypeScript support
 *
 * When to use:
 * - ✅ For derived state (values calculated from other values)
 * - ✅ When dependencies are other Properties or ComputedProperties
 * - ❌ NOT for async operations (use regular methods instead)
 * - ❌ NOT if compute function has side effects
 *
 * @important Remember to call dispose() when the ComputedProperty is no longer needed
 * to prevent memory leaks by unsubscribing from all dependencies.
 */
export class ComputedProperty<V = any> {
    private _value?: V;
    private watchers: ((value: V | undefined) => void)[] = [];
    private unsubscribers: (() => void)[] = [];
    /**
     * Optional name for debugging purposes.
     * When provided, recalculations will be logged to the console in development mode.
     */
    readonly name?: string;

    /**
     * @param compute - Function that calculates the derived value
     * @param dependencies - Array of Properties this computed value depends on
     * @param name - Optional name for debugging
     */
    constructor(
        private compute: () => V,
        dependencies: Property<any>[],
        name?: string
    ) {
        this.name = name;
        this.recalculate();

        // Watch all dependencies - when any changes, recalculate
        for (const dep of dependencies) {
            this.unsubscribers.push(
                dep.watch(() => this.recalculate())
            );
        }
    }

    private recalculate() {
        const newValue = this.compute();
        if (newValue !== this._value) {
            this._value = newValue;
            for (const watcher of this.watchers) {
                watcher(newValue);
            }
        }
    }

    get value() {
        return this._value;
    }

    watch(watcher: (value: V | undefined) => void) {
        this.watchers.push(watcher);
        return () => {
            this.watchers = this.watchers.filter(w => w !== watcher);
        };
    }

    /**
     * Dispose of this ComputedProperty by unsubscribing from all dependencies.
     * Call this when the ComputedProperty is no longer needed to prevent memory leaks.
     *
     * @example
     * ```typescript
     * const computed = new ComputedProperty(...);
     *
     * // Later, when cleaning up:
     * computed.dispose();
     * ```
     */
    dispose() {
        for (const unsub of this.unsubscribers) {
            unsub();
        }
        this.watchers = [];
    }
}
