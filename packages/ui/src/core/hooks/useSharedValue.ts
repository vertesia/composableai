import { Dispatch, SetStateAction, useState } from "react";


export class SharedValue<T> {
    constructor(private state: [T, Dispatch<SetStateAction<T>>]) {
    }

    get() {
        return this.state[0];
    }
    set(value: T) {
        this.state[1](value);
    }
}

/**
 * Share a stateful value
 */
export function useSharedValue<T>(initialValue: T | (() => T)) {
    const state = useState(initialValue);
    return new SharedValue(state);
}