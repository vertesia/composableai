import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

afterEach(() => {
    cleanup();
});

// jsdom lacks ResizeObserver, which several Radix-backed components use
// (Popover trigger width measurement, etc.). Provide a no-op polyfill.
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverPolyfill {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver = ResizeObserverPolyfill;
}
