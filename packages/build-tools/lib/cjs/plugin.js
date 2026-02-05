"use strict";
/**
 * Core Rollup plugin implementation for transforming imports
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vertesiaImportPlugin = vertesiaImportPlugin;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const asset_copy_js_1 = require("./utils/asset-copy.js");
const widget_compiler_js_1 = require("./utils/widget-compiler.js");
/**
 * Creates a Rollup plugin that transforms imports based on configured rules
 */
function vertesiaImportPlugin(config) {
    const { transformers, assetsDir = './dist', widgetConfig } = config;
    if (!transformers || transformers.length === 0) {
        throw new Error('vertesiaImportPlugin: At least one transformer must be configured');
    }
    // Track assets to copy and widgets to compile
    const assetsToProcess = [];
    const widgetsToCompile = [];
    const shouldCopyAssets = assetsDir !== false;
    const shouldCompileWidgets = widgetConfig !== undefined && assetsDir !== false;
    return {
        name: 'vertesia-import-plugin',
        /**
         * Resolve import IDs to handle pattern-based imports
         */
        resolveId(source, importer) {
            // Check if any transformer pattern matches
            for (const transformer of transformers) {
                if (transformer.pattern.test(source)) {
                    // Handle relative imports
                    if (source.startsWith('.') && importer) {
                        const cleanSource = source.replace(transformer.pattern, '');
                        // Strip query parameters from importer to get the file path
                        const cleanImporter = importer.indexOf('?') >= 0
                            ? importer.substring(0, importer.indexOf('?'))
                            : importer;
                        // Always use dirname to get the directory containing the importer
                        const baseDir = node_path_1.default.dirname(cleanImporter);
                        const resolved = node_path_1.default.resolve(baseDir, cleanSource);
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
        async load(id) {
            // Find matching transformer
            let matchedTransformer;
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
                // Read file content (skip for virtual transforms)
                const content = matchedTransformer.virtual
                    ? ''
                    : (0, node_fs_1.readFileSync)(cleanId, 'utf-8');
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
                        throw new Error(`Validation failed for ${id}:\n${errors}`);
                    }
                }
                // Generate code
                const imports = result.imports ? result.imports.join('\n') + '\n\n' : '';
                if (result.code) {
                    // Custom code provided - prepend imports
                    return imports + result.code;
                }
                else {
                    // Default: export data (escape if string, otherwise stringify as JSON)
                    const dataJson = JSON.stringify(result.data, null, 2);
                    return `${imports}export default ${dataJson};`;
                }
            }
            catch (error) {
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
                    const copied = (0, asset_copy_js_1.copyAssets)(assetsToProcess, assetsDir);
                    console.log(`Copied ${copied} asset file(s) to ${assetsDir}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.warn(`Failed to copy assets: ${message}`);
                }
            }
            // Compile widgets
            if (shouldCompileWidgets && widgetsToCompile.length > 0) {
                try {
                    const widgetsDir = config.widgetsDir || 'widgets';
                    const outputDir = node_path_1.default.join(assetsDir, widgetsDir);
                    console.log(`Compiling ${widgetsToCompile.length} widget(s)...`);
                    const compiled = await (0, widget_compiler_js_1.compileWidgets)(widgetsToCompile, outputDir, widgetConfig);
                    console.log(`Compiled ${compiled} widget(s) to ${outputDir}`);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Failed to compile widgets: ${message}`);
                }
            }
        }
    };
}
//# sourceMappingURL=plugin.js.map