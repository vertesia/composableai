/**
 * Vite-specific helpers for tool server development.
 *
 * Provides a pre-configured Vite plugin that handles SKILL.md, prompt,
 * and raw file imports — the same transforms used by rollup at build time.
 *
 * @example
 * ```typescript
 * // vite.server.config.ts
 * import { defineConfig } from 'vite';
 * import devServer from '@hono/vite-dev-server';
 * import { vertesiaDevServerPlugin } from '@vertesia/build-tools/vite';
 *
 * export default defineConfig({
 *     plugins: [
 *         vertesiaDevServerPlugin(),
 *         devServer({ entry: 'tools/server.ts' }),
 *     ],
 * });
 * ```
 */

import type { Plugin } from 'rollup';
import { vertesiaImportPlugin } from './plugin.js';
import { skillTransformer, rawTransformer, promptTransformer } from './presets/index.js';
import type { PluginConfig } from './types.js';

/**
 * Creates a pre-configured Vite plugin for tool server dev mode.
 * Includes skill, prompt, and raw file transformers with asset copying disabled
 * (assets are only needed at build time, not during dev).
 *
 * @param overrides - Optional overrides for the plugin config
 */
export function vertesiaDevServerPlugin(overrides?: Partial<PluginConfig>): Plugin {
    return vertesiaImportPlugin({
        transformers: [
            skillTransformer,
            promptTransformer,
            rawTransformer,
        ],
        assetsDir: false,
        ...overrides,
    });
}
