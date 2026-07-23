import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCssExports, vertesiaPluginBuilder } from './index.js';

/** Write the generated statements to a module and import it, like a browser would. */
async function evaluateCssExports(css: string): Promise<{ css: string; cssMeta: { supports: string[] } }> {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-builder-test-'));
    const file = join(dir, 'plugin.mjs');
    writeFileSync(file, buildCssExports('css', css));
    return import(pathToFileURL(file).href);
}

describe('buildCssExports', () => {
    it('preserves the backslash escapes of Tailwind selectors through module evaluation', async () => {
        const css = '.md\\:flex { display: flex; }\n.p-1\\.5 { padding: 0.375rem; }\n.top-1\\/2 { top: 50%; }';
        const mod = await evaluateCssExports(css);
        expect(mod.css).toBe(css);
    });

    it('preserves backticks and dollar-brace sequences', async () => {
        const css = ".x::after { content: '`${boom}`'; }";
        const mod = await evaluateCssExports(css);
        expect(mod.css).toBe(css);
    });

    it('emits the cssMeta capability list', async () => {
        const mod = await evaluateCssExports('.a { color: red; }');
        expect(mod.cssMeta).toEqual({ supports: ['shadow', 'css'] });
    });

    it('names the css export after the cssVar option', () => {
        expect(buildCssExports('style', '.a {}')).toContain('export const style = ');
    });

    it('omits the cssMeta export when the module carries its own', () => {
        expect(buildCssExports('css', '.a {}', false)).not.toContain('cssMeta');
    });
});

describe('bundle hooks (cssMeta collision guard)', () => {
    interface TestModule {
        css: string;
        cssMeta?: { supports: string[] };
    }

    interface BundleHooks {
        generateBundle(options: unknown, bundle: unknown): void;
        writeBundle(this: { warn(msg: string): void }, options: { dir: string }, bundle: unknown): void;
    }
    const createPlugin = () => vertesiaPluginBuilder() as unknown as BundleHooks;

    /**
     * Drive generateBundle + writeBundle against a synthetic bundle the way Rollup
     * would, then import the rewritten plugin.js like a browser would. `exports` is
     * the chunk metadata Rollup reports; `jsContent` is the bundled code shape.
     */
    async function runBundleHooks(jsContent: string, exports: string[], plugin: BundleHooks = createPlugin()) {
        const dir = mkdtempSync(join(tmpdir(), 'plugin-builder-bundle-'));
        writeFileSync(join(dir, 'plugin.css'), '.a { color: red; }');
        writeFileSync(join(dir, 'plugin.js'), jsContent);
        const bundle = {
            'plugin.css': { type: 'asset' },
            'plugin.js': { type: 'chunk', code: jsContent, exports, imports: [], dynamicImports: [] },
        };
        const warnings: string[] = [];
        plugin.generateBundle({}, bundle);
        plugin.writeBundle.call({ warn: (msg: string) => warnings.push(msg) }, { dir }, bundle);
        const mod: TestModule = await import(pathToFileURL(join(dir, 'plugin.js')).href);
        return { mod, warnings, written: readFileSync(join(dir, 'plugin.js'), 'utf8') };
    }

    it('appends the css and default cssMeta exports to a module without its own', async () => {
        const { mod, warnings } = await runBundleHooks('export default 1;', ['default']);
        expect(mod.css).toContain('color: red');
        expect(mod.cssMeta).toEqual({ supports: ['shadow', 'css'] });
        expect(warnings).toEqual([]);
    });

    it('keeps a hand-written cssMeta export and warns, whatever shape the bundler emitted', async () => {
        // rolldown lowers `export const cssMeta = ...` to var + export list; minifiers alias it.
        // Detection must come from the chunk's exports metadata, not the code text.
        const lowered = "var cssMeta = { supports: ['css'] };\nexport { cssMeta };\nexport default 1;";
        const { mod, warnings } = await runBundleHooks(lowered, ['cssMeta', 'default']);
        // a missed guard appends a duplicate export and this import throws a SyntaxError
        expect(mod.cssMeta).toEqual({ supports: ['css'] });
        expect(mod.css).toContain('color: red');
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('cssMeta');
    });

    it('ignores cssMeta-looking text that the bundle does not actually export', async () => {
        const stringOnly = 'export default "export const cssMeta = {};";';
        const { mod, written } = await runBundleHooks(stringOnly, ['default']);
        expect(mod.cssMeta).toEqual({ supports: ['shadow', 'css'] });
        // the string content is untouched (the old transform-hook approach rewrote it)
        expect(written).toContain('export default "export const cssMeta = {};"');
    });

    it('re-decides per build, so a removed author export does not go stale in watch mode', async () => {
        const plugin = createPlugin();
        const withMeta = await runBundleHooks(
            'var cssMeta = {};\nexport { cssMeta };\nexport default 1;',
            ['cssMeta', 'default'],
            plugin,
        );
        expect(withMeta.written).not.toContain("supports: ['shadow', 'css']");
        const withoutMeta = await runBundleHooks('export default 1;', ['default'], plugin);
        expect(withoutMeta.mod.cssMeta).toEqual({ supports: ['shadow', 'css'] });
    });
});
