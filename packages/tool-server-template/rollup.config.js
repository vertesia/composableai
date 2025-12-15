/**
 * Rollup Configuration for Server Build
 *
 * This configuration handles:
 * 1. TypeScript compilation (src → lib) with preserveModules
 * 2. Raw file imports (?raw) for template files
 *
 * Browser bundles are in rollup.config.browser.js
 */
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
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
// Exit Plugin - Forces process exit after build completes
// This prevents TypeScript plugin from keeping the process alive
// ============================================================================
function exitPlugin() {
    return {
        name: 'force-exit',
        closeBundle() {
            console.log('Tool server build Done');
            // Force exit after bundle completes to prevent hanging
            setImmediate(() => process.exit(0));
        }
    };
}

// ============================================================================
// Server Build Configuration (TypeScript → JavaScript)
// ============================================================================
const serverBuild = {
    input: {
        server: './src/server.ts',
        'server-node': './src/server-node.ts',
        'build-site': './src/build-site.ts',
        'copy-assets': './src/copy-assets.ts'
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
        json(),
        exitPlugin()
    ]
};

// ============================================================================
// Export server build configuration only
// ============================================================================
export default serverBuild;
