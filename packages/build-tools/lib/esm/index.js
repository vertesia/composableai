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
// Presets
export { skillTransformer, rawTransformer, skillCollectionTransformer, promptTransformer, SkillDefinitionSchema, PromptDefinitionSchema, PromptRole, TemplateType } from './presets/index.js';
// Utilities
export { parseFrontmatter } from './parsers/frontmatter.js';
//# sourceMappingURL=index.js.map