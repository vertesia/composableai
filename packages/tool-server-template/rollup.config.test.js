/**
 * Minimal Rollup Config for Testing
 * Just compiles server.ts to output folder - nothing fancy
 */
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import path from 'path';

// Raw plugin to handle ?raw imports
function rawPlugin() {
    return {
        name: 'raw-loader',
        resolveId(id, importer) {
            if (id.endsWith('?raw')) {
                const cleanId = id.slice(0, -4);
                if (cleanId.startsWith('.') && importer) {
                    const resolved = path.resolve(path.dirname(importer), cleanId);
                    return resolved + '?raw';
                }
                return id;
            }
        },
        load(id) {
            if (id.endsWith('?raw')) {
                const filePath = id.slice(0, -4);
                const content = fs.readFileSync(filePath, 'utf-8');
                return `export default ${JSON.stringify(content)}`;
            }
        }
    };
}

export default {
    input: './src/server.ts',
    output: {
        file: 'output/server.js',
        format: 'es',
        sourcemap: true
    },
    external: (id) => {
        // Externalize all node modules
        return !id.startsWith('.') && !id.startsWith('/');
    },
    plugins: [
        rawPlugin(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: false,
            declarationMap: false,
            sourceMap: true,
            compilerOptions: {
                outDir: 'output'
            }
        }),
        // Force exit in CI after bundle completes
        {
            name: 'ci-exit',
            closeBundle() {
                if (process.env.CI) {
                    console.log('CI: Build complete, forcing exit...');
                    // Use setImmediate to ensure all async operations finish first
                    setImmediate(() => process.exit(0));
                }
            }
        }
    ]
};
