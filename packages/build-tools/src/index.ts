/**
 * Vertesia Build Tools
 *
 * Transformers for custom import syntaxes (`?skill`, `?raw`, `?prompt`, `?template`,
 * `?skills`, `?templates`) plus rollup + vite plugins that wire them in.
 *
 * @example
 * ```typescript
 * import { vertesiaImportPlugin, skillTransformer, rawTransformer } from '@vertesia/build-tools';
 *
 * export default {
 *   plugins: [
 *     vertesiaImportPlugin({
 *       transformers: [skillTransformer, rawTransformer]
 *     })
 *   ]
 * };
 * ```
 */

// esbuild-based widget bundler
export {
    compileWidget,
    compileWidgets,
    type WidgetCompilerConfig,
    type WidgetInput,
} from './core/compilers/widget.js';
// Parsers
export { type FrontmatterResult, parseFrontmatter } from './core/parsers/frontmatter.js';
// Transformers (the pure transformation functions)
export {
    type PromptContentType,
    type PromptDefinition,
    PromptDefinitionSchema,
    PromptRole,
    promptTransformer,
    type RenderingTemplateDefinition,
    RenderingTemplateDefinitionSchema,
    rawTransformer,
    type SkillContentType,
    type SkillDefinition,
    SkillDefinitionSchema,
    SkillPropertiesSchema,
    skillCollectionTransformer,
    skillTransformer,
    TemplateType,
    templateCollectionTransformer,
    templateTransformer,
} from './core/transformers/index.js';
// Types
export type {
    AssetFile,
    PluginConfig,
    TransformerPreset,
    TransformerRule,
    TransformFunction,
    TransformResult,
    WidgetConfig,
} from './core/types.js';
// CLI-friendly transformer name registry
export {
    BUILTIN_TRANSFORMER_NAMES,
    BUILTIN_TRANSFORMERS,
    resolveTransformerNames,
} from './import-transform/builtins.js';
// Standalone import transformer (tsc → vertesia-build pipeline)
export {
    type TransformImportsOptions,
    type TransformImportsResult,
    transformImports,
} from './import-transform/index.js';
// Rollup integration
export { vertesiaImportPlugin } from './rollup/plugin.js';
export {
    createRollupTypescript,
    isRollupWatchMode,
    type RollupTypescriptOptions,
} from './rollup/typescript.js';
