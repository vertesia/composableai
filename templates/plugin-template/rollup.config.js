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

import { builtinModules } from 'node:module';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {
    promptTransformer,
    rawTransformer,
    skillCollectionTransformer,
    skillTransformer,
    templateCollectionTransformer,
    templateTransformer,
    vertesiaImportPlugin,
} from '@vertesia/build-tools';

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

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
        },
    };
}

// ============================================================================
// Server Build Configuration (TypeScript → JavaScript)
// ============================================================================
const serverBuild = {
    input: {
        server: './src/tool-server/server.ts',
        'server-node': './src/tool-server/server-node.ts',
    },
    output: {
        dir: 'lib',
        format: 'es',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'src/tool-server',
        entryFileNames: '[name].js',
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
                skillTransformer, // Handles .md?skill imports
                skillCollectionTransformer, // Handles ?skills imports
                templateTransformer, // Handles TEMPLATE.md imports
                templateCollectionTransformer, // Handles ?templates imports
                promptTransformer, // Handles ?prompt imports
                rawTransformer, // Handles ?raw imports
            ],
            assetsDir: './dist',
            widgetConfig: {
                minify: false,
                tsconfig: './tsconfig.widgets.json',
            },
        }),
        typescript({
            tsconfig: './tsconfig.tool-server.json',
            declaration: true,
            declarationDir: 'lib',
            sourceMap: true,
        }),
        json(),
    ],
};

const runtimeBundle = {
    input: './src/tool-server/server.ts',
    output: {
        file: 'lib/server.js',
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true,
    },
    external: (id) => nodeBuiltins.has(id),
    plugins: [
        vertesiaImportPlugin({
            transformers: [
                skillTransformer,
                skillCollectionTransformer,
                templateTransformer,
                templateCollectionTransformer,
                promptTransformer,
                rawTransformer,
            ],
            assetsDir: './dist',
            widgetConfig: {
                minify: false,
                tsconfig: './tsconfig.widgets.json',
            },
        }),
        nodeResolve({
            browser: false,
            preferBuiltins: true,
            exportConditions: ['node', 'import', 'default'],
        }),
        commonjs(),
        json(),
        typescript({
            tsconfig: './tsconfig.tool-server.json',
            declaration: false,
            declarationMap: false,
            sourceMap: true,
        }),
        exitPlugin(),
    ],
};

// ============================================================================
// Export declaration/preserve-modules build plus bundled runtime entry
// ============================================================================
export default [serverBuild, runtimeBundle];
