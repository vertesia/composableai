import fs from 'fs';
import path from 'path';
import { defineConfig } from 'rolldown';
import { EXTERNALS } from './externals.js';

const outputDir = path.resolve('lib');
const esmOutputDir = path.join(outputDir, 'esm');


// Get all directories with index.ts or index.tsx
const entries = fs.readdirSync(esmOutputDir).filter((name) => {
    const dir = path.join(esmOutputDir, name);
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
    input: path.join(outputDir, 'esm', name, 'index.js'),
    platform: 'browser',
    resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'import', 'default'],
    },
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
        minify: true,
    },
    external: EXTERNALS,
    plugins: [],
}));

export default defineConfig([...jsEntries]);
