/**
 * Unified Rollup Configuration
 *
 * This configuration handles:
 * 1. TypeScript compilation (src → lib) with preserveModules
 * 2. Raw file imports (?raw) for template files
 * 3. Browser bundles for tool collections (lib/tools → dist/libs)
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Raw Plugin - Supports ?raw imports for template files
// ============================================================================
function rawPlugin() {
    return {
        name: 'raw-loader',
        resolveId(id, importer) {
            if (id.endsWith('?raw')) {
                const cleanId = id.slice(0, -4); // Remove '?raw'
                if (cleanId.startsWith('.') && importer) {
                    // Resolve relative path
                    const resolved = path.resolve(path.dirname(importer), cleanId);
                    return resolved + '?raw';
                }
                return id;
            }
        },
        load(id) {
            if (id.endsWith('?raw')) {
                const filePath = id.slice(0, -4); // Remove '?raw'
                const content = fs.readFileSync(filePath, 'utf-8');
                return `export default ${JSON.stringify(content)}`;
            }
        }
    };
}

// ============================================================================
// Configuration 1: Build Server Code (TypeScript → JavaScript)
// ============================================================================
const serverBuild = {
    input: {
        server: './src/server.ts',
        'server-node': './src/server-node.ts',
        'build-site': './src/build-site.ts'
    },
    output: {
        dir: 'lib',
        format: 'es',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js'
    },
    external: (id) => {
        // Keep relative imports as part of the bundle
        if (id.startsWith('.') || id.startsWith('/')) {
            return false;
        }
        // Externalize all node modules and absolute imports
        return true;
    },
    plugins: [
        rawPlugin(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: 'lib',
            sourceMap: true
        }),
        json()
    ]
};

// ============================================================================
// Configuration 2: Browser Bundles (Tool Collections)
// ============================================================================
const libToolCollectionsDir = './lib/tools';
const outputDir = './dist/libs';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all directories in lib/tools with an index.js
const entries = fs.existsSync(libToolCollectionsDir)
    ? fs.readdirSync(libToolCollectionsDir).filter((name) => {
          const dir = path.join(libToolCollectionsDir, name);
          return (
              fs.statSync(dir).isDirectory() &&
              fs.existsSync(path.join(dir, 'index.js'))
          );
      })
    : [];

// Create a bundle configuration for each tool collection
const browserBundles = entries.map((name) => ({
    input: path.join(libToolCollectionsDir, name, 'index.js'),
    output: {
        file: path.join(outputDir, `tool-server-${name}.js`),
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),
        json(),
        commonjs(),
        terser({
            compress: {
                drop_console: false
            }
        })
    ]
}));

// ============================================================================
// Export all configurations
// ============================================================================
export default [
    serverBuild,
    ...browserBundles
];
