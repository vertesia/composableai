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
export { vertesiaImportPlugin } from './plugin.js';
export type { PluginConfig, TransformerRule, TransformerPreset, TransformFunction, TransformResult, AssetFile, WidgetConfig } from './types.js';
export { skillTransformer, rawTransformer, skillCollectionTransformer, promptTransformer, SkillDefinitionSchema, PromptDefinitionSchema, type SkillDefinition, type SkillContentType, type PromptDefinition, type PromptContentType, PromptRole, TemplateType } from './presets/index.js';
export { parseFrontmatter, type FrontmatterResult } from './parsers/frontmatter.js';
//# sourceMappingURL=index.d.ts.map