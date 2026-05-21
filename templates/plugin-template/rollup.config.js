/**
 * Rolldown Configuration for Server Build
 *
 * This configuration handles:
 * 1. TypeScript compilation (src → lib) with preserveModules
 * 2. Import transformations via @vertesia/build-tools
 *    - Raw file imports (?raw) for template files
 *    - Skill imports (?skill) for markdown skill definitions
 *
 * Browser bundles are in rollup.config.browser.js
 */
import { defineConfig } from 'rolldown';
import {
    vertesiaImportPlugin,
    skillTransformer,
    rawTransformer,
    skillCollectionTransformer,
    templateTransformer,
    templateCollectionTransformer,
    promptTransformer,
    typescriptTypecheckPlugin,
} from '@vertesia/build-tools';

// ============================================================================
// Server Build Configuration (TypeScript → JavaScript)
// ============================================================================
const serverBuild = defineConfig({
    input: {
        server: './src/tool-server/server.ts',
        'server-node': './src/tool-server/server-node.ts',
    },
    platform: 'node',
    tsconfig: './tsconfig.tool-server.json',
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
        extensionAlias: {
            '.js': ['.ts', '.tsx', '.js'],
        },
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
    // Treat TypeScript diagnostics from @rollup/plugin-typescript as build errors
    // instead of warnings, so type issues fail the build.
    onwarn(warning, defaultHandler) {
        if (warning.plugin === 'typescript') {
            throw new Error(warning.message ?? String(warning));
        }
        defaultHandler(warning);
    },
    plugins: [
        typescriptTypecheckPlugin({
            tsconfig: './tsconfig.tool-server.json',
            mode: 'emitDeclarationOnly',
        }),
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
    ]
});

// ============================================================================
// Export server build configuration only
// ============================================================================
export default serverBuild;
