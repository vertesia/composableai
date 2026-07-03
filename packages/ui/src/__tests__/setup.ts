import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

afterEach(() => {
    cleanup();
});

function createMemoryStorage(): Storage {
    const values = new Map<string, string>();
    return {
        get length() {
            return values.size;
        },
        clear() {
            values.clear();
        },
        getItem(key: string) {
            return values.get(String(key)) ?? null;
        },
        key(index: number) {
            return Array.from(values.keys())[index] ?? null;
        },
        removeItem(key: string) {
            values.delete(String(key));
        },
        setItem(key: string, value: string) {
            values.set(String(key), String(value));
        },
    };
}

function readWindowStorage(name: 'localStorage' | 'sessionStorage'): Storage | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    return descriptor && 'value' in descriptor && descriptor.value ? descriptor.value : undefined;
}

function exposeDomStorage(name: 'localStorage' | 'sessionStorage'): void {
    // Node 26 exposes Web Storage globals through getters that return undefined
    // unless Node is started with --localstorage-file. In jsdom tests, use the
    // jsdom window storage objects as the globals instead; if those are also
    // unavailable, fall back to a minimal in-memory Storage implementation.
    const storage = readWindowStorage(name) ?? createMemoryStorage();
    Object.defineProperty(globalThis, name, {
        configurable: true,
        value: storage,
    });
    if (typeof window !== 'undefined') {
        Object.defineProperty(window, name, {
            configurable: true,
            value: storage,
        });
    }
}

exposeDomStorage('localStorage');
exposeDomStorage('sessionStorage');

// jsdom lacks ResizeObserver, which several Radix-backed components use
// (Popover trigger width measurement, etc.). Provide a no-op polyfill.
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverPolyfill {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
        ResizeObserverPolyfill;
}
