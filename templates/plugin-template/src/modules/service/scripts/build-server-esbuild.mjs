// Option B — self-contained tool-server bundle via esbuild (drop-in for `rollup -c`).
// Bundles src/tool-server/{server,server-node,config}.ts into lib/ with ONLY Node builtins
// external, so the published lib/server.js runs with no node_modules. Ports the rollup
// vertesia import transformers (?skill/?template/?prompt/?raw) to esbuild so skill/interaction
// apps bundle too. write-app-package.mjs still emits dist/app-package*.json afterwards.

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderTransformerModule, validateBuiltInteractionPrompts } from './build-server-support.mjs';

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
            // A transformed import may be suffixed (`./SKILL.md?skill`) OR bare (`./SKILL.md`,
            // `./TEMPLATE.md`) — handle both: no `?` means an empty query suffix, not slice(-1).
            const q = args.path.indexOf('?');
            const clean = q >= 0 ? args.path.slice(0, q) : args.path;
            const suffix = q >= 0 ? args.path.slice(q) : '';
            const abs = isAbsolute(clean) ? clean : resolve(args.resolveDir || dirname(args.importer), clean);
            return { path: abs + suffix, namespace: 'vtx' };
        });
        b.onLoad({ filter: /.*/, namespace: 'vtx' }, async (args) => {
            const q = args.path.indexOf('?');
            const clean = q >= 0 ? args.path.slice(0, q) : args.path;
            // Match the transformer against the FULL path (suffixed or bare filename).
            const rule = rules.find((r) => r.pattern.test(args.path));
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
            if (rule.schema) {
                const validation = rule.schema.safeParse(r.data);
                if (!validation.success) {
                    const errors = validation.error.issues
                        .map((error) => `  - ${error.path.join('.')}: ${error.message}`)
                        .join('\n');
                    throw new Error(`Validation failed for ${clean}:\n${errors}`);
                }
            }
            return { contents: renderTransformerModule(r), loader: 'js', resolveDir: dirname(clean) };
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

// Import the actual production bundle, not the TypeScript source. This catches transformer or
// bundler regressions that source-level interaction tests cannot see (for example a `?prompt`
// import silently becoming `{}` and reaching the model as an empty message list).
const builtConfigUrl = pathToFileURL(resolve('lib/config.js')).href;
const { ServerConfig: builtServerConfig } = await import(`${builtConfigUrl}?validation=${Date.now()}`);
const interactionValidation = validateBuiltInteractionPrompts(builtServerConfig);
console.log(
    `[B] validated ${interactionValidation.promptCount} prompt(s) across ${interactionValidation.interactionCount} interaction(s)`,
);

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
