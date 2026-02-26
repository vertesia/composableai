/**
 * Rollup Configuration for Server Build
 *
 * This configuration handles:
 * 1. TypeScript compilation (src → lib) with preserveModules
 * 2. Import transformations via @vertesia/build-tools
 *    - Raw file imports (?raw) for template files
 *    - Skill imports (?skill) for markdown skill definitions
 *
 * Browser bundles are in rollup.config.browser.js
 */
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import { vertesiaImportPlugin, skillTransformer, rawTransformer, skillCollectionTransformer, templateTransformer, templateCollectionTransformer, promptTransformer } from '@vertesia/build-tools';

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
        server: './src/tool-server/server.ts',
        'server-node': './src/tool-server/server-node.ts',
        'build-site': './src/tool-server/build-site.ts'
    },
    output: {
        dir: 'lib',
        format: 'es',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'src/tool-server',
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
        vertesiaImportPlugin({
            transformers: [
                skillTransformer,              // Handles .md?skill imports
                skillCollectionTransformer,    // Handles ?skills imports
                templateTransformer,           // Handles TEMPLATE.md imports
                templateCollectionTransformer, // Handles ?templates imports
                promptTransformer,             // Handles ?prompt imports
                rawTransformer                 // Handles ?raw imports
            ],
            assetsDir: './dist',
            widgetConfig: {
                minify: false,
                tsconfig: './tsconfig.widgets.json'
            }

        }),
        typescript({
            tsconfig: './tsconfig.tool-server.json',
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
