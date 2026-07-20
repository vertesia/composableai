import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'rolldown';
import { EXTERNALS } from './externals.js';

const outputDir = path.resolve('lib');

// React-family externals that a bundled CommonJS dependency may `require()`.
// (e.g. `use-sync-external-store`, pulled in by `@tiptap/react`, does
// `require("react")`.) Longest specifiers first so the alternation below never
// matches a prefix (`react`) inside a longer name (`react-dom`).
const CJS_REACT_EXTERNALS = ['react/jsx-runtime', 'react-dom', 'react'];
const REDIRECT_PREFIX = 'vertesia-cjs-react:';

/**
 * When rolldown bundles a CommonJS module that does `require("react")` (or
 * another external React-family module), it wraps the call in a runtime `require`
 * shim that THROWS in the browser: "Calling `require` for "react" in an
 * environment that doesn't expose the `require` function". Rollup's commonjs
 * plugin used to rewrite those external requires into ESM imports; the rolldown
 * migration lost that, and rolldown's own `esmExternalRequirePlugin` only rewrites
 * top-level ESM requires, not requires nested inside wrapped CJS modules.
 *
 * This plugin restores the behaviour: it redirects a CJS `require()` of an
 * external React-family module to a tiny bundled ESM module that re-exports the
 * (still-external, single-instance) module, so the `require()` resolves to real
 * runtime bindings instead of the throwing shim.
 */
function cjsExternalReactInterop() {
    const requireRe = new RegExp(`require\\(\\s*["'](${CJS_REACT_EXTERNALS.join('|')})["']\\s*\\)`, 'g');
    const virtualPrefix = `\0${REDIRECT_PREFIX}`;
    return {
        name: 'cjs-external-react-interop',
        transform(code) {
            if (!code.includes('require(')) return null;
            requireRe.lastIndex = 0;
            if (!requireRe.test(code)) return null;
            requireRe.lastIndex = 0;
            return {
                code: code.replace(requireRe, (_match, spec) => `require("${REDIRECT_PREFIX}${spec}")`),
                map: null,
            };
        },
        resolveId(source) {
            if (source.startsWith(REDIRECT_PREFIX)) return `\0${source}`;
            return null;
        },
        load(id) {
            if (id.startsWith(virtualPrefix)) {
                const spec = id.slice(virtualPrefix.length);
                const s = JSON.stringify(spec);
                return `import * as __mod from ${s};\nexport * from ${s};\nexport default __mod;`;
            }
            return null;
        },
    };
}

// Get all directories with an index.js (each becomes a CDN-bundled named export).
const entries = fs.readdirSync(outputDir).filter((name) => {
    const dir = path.join(outputDir, name);
    try {
        if (fs.statSync(dir).isDirectory()) {
            return fs.existsSync(path.join(dir, 'index.js'));
        }
    } catch {
        // ignore
    }
    return false;
});

const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, name, 'index.js'),
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    external: EXTERNALS,
    plugins: [cjsExternalReactInterop()],
    // Substitute `process.env.NODE_ENV` at build time so the published bundle never
    // references the Node-only `process` global (browser consumers would otherwise
    // crash). Pinning to "production" also lets minification drop dev-only branches.
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
}));

export default defineConfig([...jsEntries]);
