import path from 'path';
import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
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
    external: ['react', 'react-dom'],
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: 'lib/types',
            emitDeclarationOnly: false,
            outDir: outputDir,
            rootDir: inputDir,
        }),
    ],
}));

export default defineConfig([...jsEntries]);
