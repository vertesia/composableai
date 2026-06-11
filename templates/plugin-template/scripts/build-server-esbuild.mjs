// Option B — self-contained tool-server bundle via esbuild (drop-in for `rollup -c`).
// Bundles src/tool-server/{server,server-node,config}.ts into lib/ with ONLY Node builtins
// external, so the published lib/server.js runs with no node_modules. Ports the rollup
// vertesia import transformers (?skill/?template/?prompt/?raw) to esbuild so skill/interaction
// apps bundle too. write-app-package.mjs still emits dist/app-package*.json afterwards.

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { build } from 'esbuild';

const bt = await import('@vertesia/build-tools');
// Transformers are TransformerRule objects: { pattern: RegExp, transform: fn, virtual?: bool }.
const rules = [
    bt.skillCollectionTransformer,
    bt.skillTransformer,
    bt.templateCollectionTransformer,
    bt.templateTransformer,
    bt.promptTransformer,
    bt.rawTransformer,
].filter((r) => r && typeof r.transform === 'function' && r.pattern);

const ANY = new RegExp(rules.map((r) => r.pattern.source).join('|'));
// Widgets (.tsx) referenced by ?skills collections are reported by the transform as
// result.widgets = [{ name, path }]. The rollup build compiled them via build-tools'
// compileWidgets (rollup, react external); we collect them here and esbuild-compile them
// to dist/widgets/<name>.js after the server bundle so widget apps keep working.
const collectedWidgets = new Map();
const plugin = {
    name: 'vertesia-transforms',
    setup(b) {
        if (!rules.length) return;
        b.onResolve({ filter: ANY }, (args) => {
            const q = args.path.indexOf('?');
            const clean = args.path.slice(0, q);
            const abs = isAbsolute(clean) ? clean : resolve(args.resolveDir || dirname(args.importer), clean);
            return { path: abs + args.path.slice(q), namespace: 'vtx' };
        });
        b.onLoad({ filter: /.*/, namespace: 'vtx' }, async (args) => {
            const q = args.path.indexOf('?');
            const clean = args.path.slice(0, q);
            const rule = rules.find((r) => r.pattern.test(args.path.slice(q)));
            if (!rule) throw new Error(`no transformer for ${args.path}`);
            let content = '';
            if (!rule.virtual) {
                try {
                    content = readFileSync(clean, 'utf-8');
                } catch {}
            }
            const r = await rule.transform(content, clean);
            for (const w of r.widgets || []) {
                const wp = isAbsolute(w.path) ? w.path : resolve(dirname(clean), w.path);
                collectedWidgets.set(w.name, wp);
            }
            const imports = r.imports ? `${r.imports.join('\n')}\n\n` : '';
            return { contents: `${imports}${r.code || ''}`, loader: 'js', resolveDir: dirname(clean) };
        });
    },
};

mkdirSync('lib', { recursive: true });
await build({
    entryPoints: {
        server: 'src/tool-server/server.ts',
        'server-node': 'src/tool-server/server-node.ts',
        config: 'src/tool-server/config.ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outdir: 'lib',
    plugins: [plugin],
    logLevel: 'warning',
});
console.log('[B] esbuild self-contained bundle -> lib/server.js, lib/server-node.js, lib/config.js');

// Compile skill widgets to dist/widgets/<name>.js (browser ESM, React provided by the host).
// Mirrors build-tools' compileWidgets DEFAULT_EXTERNALS so the widget loads in the app shell.
if (collectedWidgets.size > 0) {
    mkdirSync('dist/widgets', { recursive: true });
    const WIDGET_EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];
    for (const [name, path] of collectedWidgets) {
        await build({
            entryPoints: [path],
            bundle: true,
            platform: 'browser',
            format: 'esm',
            target: 'es2022',
            jsx: 'automatic',
            external: WIDGET_EXTERNAL,
            outfile: `dist/widgets/${name}.js`,
            logLevel: 'warning',
        });
    }
    console.log(`[B] compiled ${collectedWidgets.size} widget(s) -> dist/widgets/`);
}
