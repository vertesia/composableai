/**
 * Vertesia Rollup Import Plugin
 *
 * A flexible Rollup plugin for transforming imports with custom compilers and validation.
 * Supports preset transformers for common use cases (skills, raw files) and custom transformers.
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

// Utilities
export { type FrontmatterResult, parseFrontmatter } from './parsers/frontmatter.js';
// Core plugin
export { vertesiaImportPlugin } from './plugin.js';

// Presets
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
} from './presets/index.js';
// Types
export type {
    AssetFile,
    PluginConfig,
    TransformerPreset,
    TransformerRule,
    TransformFunction,
    TransformResult,
    WidgetConfig,
} from './types.js';
export {
    createRollupTypescript,
    isRollupWatchMode,
    type RollupTypescriptOptions,
} from './utils/rollup-typescript.js';
