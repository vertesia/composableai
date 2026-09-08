import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'rolldown';
import { EXTERNALS } from './externals.js';

const outputDir = path.resolve('lib');

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

// Sub-paths whose dynamic imports must stay lazy. i18n imports each locale bundle on first use —
// inlining them costs ~800 KB of JSON in the startup graph for translations the user never reads.
// These entries emit `<stem>.<hash>.chunk.js` siblings next to the entry file; a consuming app
// that copies the entry file must copy the chunks verbatim (they are referenced by relative
// import and already content-hashed).
const CHUNKED_ENTRIES = new Set(['i18n']);

const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, name, 'index.js'),
    output: {
        format: 'es',
        sourcemap: true,
        minify: true,
        ...(CHUNKED_ENTRIES.has(name)
            ? {
                  dir: outputDir,
                  entryFileNames: `vertesia-ui-${name}.js`,
                  chunkFileNames: `vertesia-ui-${name}.[hash].chunk.js`,
              }
            : {
                  file: path.join(outputDir, `vertesia-ui-${name}.js`),
                  // Each sub-path is published as exactly one file, addressed by the consuming
                  // app's import map, so a dynamic import of an in-package module has nowhere to
                  // emit a chunk. Inline those instead; dynamic imports of *external* packages
                  // are unaffected and still resolve lazily through the import map.
                  codeSplitting: false,
              }),
    },
    external: EXTERNALS,
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
