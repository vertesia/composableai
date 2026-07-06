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

const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, name, 'index.js'),
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
        minify: true,
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
