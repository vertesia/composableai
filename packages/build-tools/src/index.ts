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

// Core plugin
export { vertesiaImportPlugin } from './plugin.js';

// Types
export type {
    PluginConfig,
    TransformerRule,
    TransformerPreset,
    TransformFunction,
    TransformResult,
    AssetFile,
    WidgetConfig
} from './types.js';

// Presets
export {
    skillTransformer,
    rawTransformer,
    skillCollectionTransformer,
    templateTransformer,
    templateCollectionTransformer,
    promptTransformer,
    SkillDefinitionSchema,
    SkillPropertiesSchema,
    RenderingTemplateDefinitionSchema,
    PromptDefinitionSchema,
    type SkillDefinition,
    type SkillContentType,
    type RenderingTemplateDefinition,
    type PromptDefinition,
    type PromptContentType,
    PromptRole,
    TemplateType
} from './presets/index.js';

// Utilities
export { parseFrontmatter, type FrontmatterResult } from './parsers/frontmatter.js';
