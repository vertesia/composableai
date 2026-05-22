import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const TARGET_FILE = 'lib/vertesia-json.js';

export default {
    input: 'src/index.ts',
    output: {
        file: TARGET_FILE,         // ES module output for browser
        format: 'es',
        sourcemap: true,
    },
    external: [
        // Add any packages you want to keep external (e.g., use via import map)
    ],
    // Treat TypeScript diagnostics from @rollup/plugin-typescript as build errors
    // instead of warnings, so type issues fail the build.
    onwarn(warning, defaultHandler) {
        if (warning.plugin === 'typescript') {
            throw new Error(warning.message ?? String(warning));
        }
        defaultHandler(warning);
    },
    plugins: [
        nodeResolve({
            browser: true,  // Prefer browser-compatible versions of packages
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),        // Convert CommonJS modules to ES6
        typescript({
            tsconfig: './tsconfig.web.json',
            sourceMap: true,
            declaration: false,
        }),
        terser(),          // Optional: minify for production
    ],
};