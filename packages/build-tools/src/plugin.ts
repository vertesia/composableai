/**
 * Core Rollup plugin implementation for transforming imports
 */

import type { Plugin } from 'rollup';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PluginConfig, TransformerRule, AssetFile } from './types.js';
import { copyAssets } from './utils/asset-copy.js';
import { compileWidgets } from './utils/widget-compiler.js';
import type { WidgetMetadata } from './utils/asset-discovery.js';

/**
 * Creates a Rollup plugin that transforms imports based on configured rules
 */
export function vertesiaImportPlugin(config: PluginConfig): Plugin {
    const { transformers, assetsDir = './dist', widgetConfig } = config;

    if (!transformers || transformers.length === 0) {
        throw new Error('vertesiaImportPlugin: At least one transformer must be configured');
    }

    // Track assets to copy and widgets to compile
    const assetsToProcess: AssetFile[] = [];
    const widgetsToCompile: WidgetMetadata[] = [];
    const shouldCopyAssets = assetsDir !== false;
    const shouldCompileWidgets = widgetConfig !== undefined && assetsDir !== false;

    return {
        name: 'vertesia-import-plugin',

        /**
         * Resolve import IDs to handle pattern-based imports
         */
        resolveId(source: string, importer: string | undefined) {
            // Check if any transformer pattern matches
            for (const transformer of transformers) {
                if (transformer.pattern.test(source)) {
                    // Handle relative imports
                    if (source.startsWith('.') && importer) {
                        const cleanSource = source.replace(transformer.pattern, '');
                        const resolved = path.resolve(path.dirname(importer), cleanSource);
                        // Return with the pattern suffix to identify it in load
                        const suffix = source.match(transformer.pattern)?.[0] || '';
                        return resolved + suffix;
                    }
                    return source;
                }
            }
            return null; // Let other plugins handle it
        },

        /**
         * Load and transform the file content
         */
        async load(id: string) {
            // Find matching transformer
            let matchedTransformer: TransformerRule | undefined;
            let cleanId = id;

            for (const transformer of transformers) {
                if (transformer.pattern.test(id)) {
                    matchedTransformer = transformer;
                    // Remove query parameters to get actual file path
                    // For example: '/path/file.md?skill' -> '/path/file.md'
                    //              '/path/file.html?raw' -> '/path/file.html'
                    const queryIndex = id.indexOf('?');
                    cleanId = queryIndex >= 0 ? id.substring(0, queryIndex) : id;
                    break;
                }
            }

            if (!matchedTransformer) {
                return null; // Not for us
            }

            try {
                // Read file content
                const content = readFileSync(cleanId, 'utf-8');

                // Transform the content
                const result = await matchedTransformer.transform(content, cleanId);

                // Collect assets if any
                if (result.assets && shouldCopyAssets) {
                    assetsToProcess.push(...result.assets);
                }

                // Collect widgets if any
                if (result.widgets && shouldCompileWidgets) {
                    widgetsToCompile.push(...result.widgets);
                }

                // Validate if schema provided
                if (matchedTransformer.schema) {
                    const validation = matchedTransformer.schema.safeParse(result.data);
                    if (!validation.success) {
                        const errors = validation.error.errors
                            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
                            .join('\n');
                        throw new Error(
                            `Validation failed for ${id}:\n${errors}`
                        );
                    }
                }

                // Generate code
                if (result.code) {
                    // Custom code provided
                    return result.code;
                } else {
                    // Default: export data (escape if string, otherwise stringify as JSON)
                    const imports = result.imports ? result.imports.join('\n') + '\n\n' : '';
                    const dataJson = JSON.stringify(result.data, null, 2);
                    return `${imports}export default ${dataJson};`;
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.error(`Failed to transform ${id}: ${message}`);
            }
        },

        /**
         * Copy assets and compile widgets after all modules are loaded
         */
        async buildEnd() {
            // Copy script assets
            if (shouldCopyAssets && assetsToProcess.length > 0) {
                try {
                    const copied = copyAssets(assetsToProcess, assetsDir as string);
                    console.log(`Copied ${copied} asset file(s) to ${assetsDir}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.warn(`Failed to copy assets: ${message}`);
                }
            }

            // Compile widgets
            if (shouldCompileWidgets && widgetsToCompile.length > 0) {
                try {
                    const widgetsDir = config.widgetsDir || 'widgets';
                    const outputDir = path.join(assetsDir as string, widgetsDir);

                    console.log(`Compiling ${widgetsToCompile.length} widget(s)...`);
                    const compiled = await compileWidgets(
                        widgetsToCompile,
                        outputDir,
                        widgetConfig
                    );
                    console.log(`Compiled ${compiled} widget(s) to ${outputDir}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Failed to compile widgets: ${message}`);
                }
            }
        }
    };
}
