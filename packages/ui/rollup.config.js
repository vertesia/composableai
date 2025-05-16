import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
//import { terser } from 'rollup-plugin-terser';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'rollup';

const inputDir = 'src';
const outputDir = 'lib';

// Get all directories with index.ts or index.tsx
const entries = fs.readdirSync(inputDir).filter((name) => {
    const dir = path.join(inputDir, name);
    const hasIndex = fs.existsSync(path.join(dir, 'index.ts')) || fs.existsSync(path.join(dir, 'index.tsx'));
    return fs.statSync(dir).isDirectory() && hasIndex;
});

const jsEntries = entries.map((name) => ({
    input: path.join(inputDir, name, 'index.ts'),
    output: {
        file: path.join(outputDir, `${name}.js`),
        format: 'es',
        sourcemap: true,
    },
    external: ['react', 'react-dom', "@vertesia/client", "@vertesia/common"],
    plugins: [
        nodeResolve({
            browser: true,  // Prefer browser-compatible versions of packages
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),        // Convert CommonJS modules to ES6
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: 'lib/types',
            emitDeclarationOnly: false,
            outDir: outputDir,
            rootDir: inputDir,
        }),
        //terser(),          // Optional: minify for production
    ],
}));

export default defineConfig([...jsEntries]);
