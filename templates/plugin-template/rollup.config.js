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

// The published service runtime imports lib/server.js with NO node_modules
// (the app-gateway runtime never runs `pnpm install`). So the bundle must be
// self-contained: bundle @vertesia/*, hono, and every other dependency, leaving
// only Node built-ins external. Externalizing app deps here produced bare
// `import '@vertesia/tools-sdk'` in lib/server.js and a "Service runtime bundle
// is not self-contained" publish failure.
const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const isNodeBuiltin = (id) => nodeBuiltins.has(id) || id.startsWith('node:');

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
    // Bundle everything except Node built-ins so the published runtime is
    // self-contained (no node_modules at runtime).
    external: (id) => isNodeBuiltin(id),
    // Treat TypeScript diagnostics from @rollup/plugin-typescript as build errors
    // instead of warnings, so type issues fail the build.
    onwarn(warning, defaultHandler) {
        if (warning.plugin === 'typescript') {
            throw new Error(warning.message ?? String(warning));
        }
        defaultHandler(warning);
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
        nodeResolve({ exportConditions: ['node', 'import', 'module', 'default'], preferBuiltins: true }),
        commonjs(),
        json(),
        exitPlugin(),
    ],
};

// ============================================================================
// Export server build configuration only
// ============================================================================
export default serverBuild;
