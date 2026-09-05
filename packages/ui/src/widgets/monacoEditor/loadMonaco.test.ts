import { afterEach, describe, expect, it, vi } from 'vitest';

// Each case imports the module fresh: loadMonaco keeps the resolved wrapper and the "pin applied"
// flag in module scope, which is the behavior under test.
afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@monaco-editor/react');
});

describe('loadMonacoReact', () => {
    it('applies the version pin once and shares one module across callers', async () => {
        const config = vi.fn();
        let imports = 0;
        vi.doMock('@monaco-editor/react', () => {
            imports++;
            return { loader: { config }, Editor: () => null };
        });
        const { loadMonacoReact } = await import('./loadMonaco.js');

        const [first, second] = await Promise.all([loadMonacoReact(), loadMonacoReact()]);

        expect(first).toBe(second);
        expect(imports).toBe(1);
        expect(config).toHaveBeenCalledTimes(1);
        expect(config).toHaveBeenCalledWith({ paths: { vs: expect.stringContaining('monaco-editor@') } });
    });

    // A memoized rejection would make every later attempt fail instantly for the rest of the
    // session, turning one transient chunk error into an editor that never opens again.
    it('retries after a failed import instead of caching the failure', async () => {
        let attempts = 0;
        vi.doMock('@monaco-editor/react', () => {
            attempts++;
            if (attempts === 1) {
                throw new Error('chunk load failed');
            }
            return { loader: { config: vi.fn() }, Editor: () => null };
        });
        const { loadMonacoReact } = await import('./loadMonaco.js');

        // Not asserted by message: vitest replaces a throwing mock factory's error with its own.
        await expect(loadMonacoReact()).rejects.toThrow();
        await expect(loadMonacoReact()).resolves.toBeDefined();
        expect(attempts).toBe(2);
    });
});
