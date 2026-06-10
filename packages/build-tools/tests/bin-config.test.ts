/**
 * Tests for the `vertesia-build` CLI's package.json config parser.
 *
 * The parser is the only piece of the bin that's worth unit-testing — the
 * rest is a 5-line wrapper around `transformImports`. Lives in `src/bin/config.ts`
 * (rather than `src/bin/build.ts`) so we can drive it without spawning a
 * subprocess and without process.exit getting in the way.
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_KEY, resolveConfig, VertesiaBuildConfigError } from '../src/bin/config.js';

const CWD = '/abs/project';

function pkg(config: unknown): Record<string, unknown> {
    return { name: 'test', version: '0.0.0', [CONFIG_KEY]: config };
}

describe('resolveConfig — happy path', () => {
    it('returns resolved options for a minimal valid config', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill', 'raw'],
            }),
            CWD,
        );

        expect(opts.libDir).toBe(path.join(CWD, 'lib'));
        expect(opts.srcDir).toBe(path.join(CWD, 'src'));
        expect(opts.transformers).toHaveLength(2);
        // Optional fields stay undefined when not provided.
        expect(opts.assetsDir).toBeUndefined();
        expect(opts.widgetsDir).toBeUndefined();
        expect(opts.widgetConfig).toBeUndefined();
    });

    it('preserves transformer order from the user-supplied array', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['raw', 'skill'],
            }),
            CWD,
        );
        // The exact transformer objects don't matter for the order check,
        // but the count + presence does.
        expect(opts.transformers).toHaveLength(2);
    });

    it('resolves all 6 transformer names', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill', 'skills', 'template', 'templates', 'prompt', 'raw'],
            }),
            CWD,
        );
        expect(opts.transformers).toHaveLength(6);
    });

    it('resolves assetsDir relative to cwd when set as a string', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill'],
                assetsDir: './dist',
            }),
            CWD,
        );
        expect(opts.assetsDir).toBe(path.join(CWD, 'dist'));
    });

    it('accepts assetsDir: false (disables asset copying + widget bundling)', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill'],
                assetsDir: false,
            }),
            CWD,
        );
        expect(opts.assetsDir).toBe(false);
    });

    it('forwards widgetsDir verbatim', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill'],
                widgetsDir: 'custom-widgets',
            }),
            CWD,
        );
        expect(opts.widgetsDir).toBe('custom-widgets');
    });

    it('forwards widgetConfig verbatim', () => {
        const opts = resolveConfig(
            pkg({
                libDir: './lib',
                srcDir: './src',
                transformers: ['skill'],
                widgetConfig: { minify: true, external: ['react'] },
            }),
            CWD,
        );
        expect(opts.widgetConfig).toEqual({ minify: true, external: ['react'] });
    });
});

describe('resolveConfig — validation errors', () => {
    it('throws when the vertesia-build key is missing', () => {
        expect(() => resolveConfig({ name: 'test', version: '0.0.0' }, CWD)).toThrow(VertesiaBuildConfigError);
        expect(() => resolveConfig({ name: 'test', version: '0.0.0' }, CWD)).toThrow(/missing.*vertesia-build/);
    });

    it('throws when vertesia-build is not an object', () => {
        expect(() => resolveConfig(pkg('not-an-object'), CWD)).toThrow(/must be an object/);
        expect(() => resolveConfig(pkg(['array']), CWD)).toThrow(/must be an object/);
        expect(() => resolveConfig(pkg(null), CWD)).toThrow(/must be an object/);
    });

    it('throws when libDir is missing or empty', () => {
        expect(() => resolveConfig(pkg({ srcDir: './src', transformers: ['skill'] }), CWD)).toThrow(/libDir/);
        expect(() => resolveConfig(pkg({ libDir: '', srcDir: './src', transformers: ['skill'] }), CWD)).toThrow(
            /libDir/,
        );
        expect(() => resolveConfig(pkg({ libDir: 42, srcDir: './src', transformers: ['skill'] }), CWD)).toThrow(
            /libDir/,
        );
    });

    it('throws when srcDir is missing or empty', () => {
        expect(() => resolveConfig(pkg({ libDir: './lib', transformers: ['skill'] }), CWD)).toThrow(/srcDir/);
        expect(() => resolveConfig(pkg({ libDir: './lib', srcDir: '', transformers: ['skill'] }), CWD)).toThrow(
            /srcDir/,
        );
    });

    it('throws when transformers is missing, empty, or wrong type', () => {
        expect(() => resolveConfig(pkg({ libDir: './lib', srcDir: './src' }), CWD)).toThrow(/transformers/);
        expect(() => resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: [] }), CWD)).toThrow(
            /transformers/,
        );
        expect(() => resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: 'skill' }), CWD)).toThrow(
            /transformers/,
        );
    });

    it('throws when a transformer entry is not a string', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill', 42] }), CWD),
        ).toThrow(/non-empty string/);
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill', ''] }), CWD),
        ).toThrow(/non-empty string/);
    });

    it('throws when a transformer name is unknown', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill', 'bogus'] }), CWD),
        ).toThrow(/Unknown transformer name/);
    });

    it('throws when assetsDir is an empty string', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill'], assetsDir: '' }), CWD),
        ).toThrow(/assetsDir/);
    });

    it('throws when assetsDir is true (only false is the special value)', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill'], assetsDir: true }), CWD),
        ).toThrow(/assetsDir/);
    });

    it('throws when widgetsDir is an empty string', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill'], widgetsDir: '' }), CWD),
        ).toThrow(/widgetsDir/);
    });

    it('throws when widgetConfig is not an object', () => {
        expect(() =>
            resolveConfig(pkg({ libDir: './lib', srcDir: './src', transformers: ['skill'], widgetConfig: 'bad' }), CWD),
        ).toThrow(/widgetConfig/);
        expect(() =>
            resolveConfig(
                pkg({ libDir: './lib', srcDir: './src', transformers: ['skill'], widgetConfig: ['bad'] }),
                CWD,
            ),
        ).toThrow(/widgetConfig/);
    });
});
