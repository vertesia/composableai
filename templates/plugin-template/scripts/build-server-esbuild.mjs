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
