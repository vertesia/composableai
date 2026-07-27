/**
 * Vertesia Build Tools
 *
 * Transformers for custom import syntaxes (`?skill`, `?raw`, `?prompt`,
 * `?template`, `?skills`, `?templates`, and bare `SKILL.md` / `TEMPLATE.md`),
 * a standalone CLI (`vertesia-build`) that runs them as a post-`tsc` step,
 * and Vite plugins for dev-mode integration.
 *
 * Two consumer entry points:
 *
 *   - **Build-time:** invoke the `vertesia-build` CLI from your package
 *     scripts (after `tsc`). Config lives under `vertesia-build` in your
 *     `package.json`. The CLI calls `transformImports()` internally — you
 *     can also call it directly if you need finer control.
 *
 *   - **Dev-time (Vite):** import `vertesiaDevServerPlugin` (or
 *     `apiServerPlugin` for full Hono tool-server wiring) from
 *     `@vertesia/build-tools/vite`. Same transformers, same behavior,
 *     applied to source files at request time.
 *
 * @example
 * ```typescript
 * import { resolveTransformerNames, transformImports } from '@vertesia/build-tools';
 *
 * await transformImports({
 *   libDir: './lib',
 *   srcDir: './src',
 *   // Resolved rules, not names — use resolveTransformerNames to go from one to the other.
 *   transformers: resolveTransformerNames(['skill', 'raw']),
 *   assetsDir: './dist',
 * });
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
export {
    loadSkillCatalog,
    readPackageJson,
} from './core/skill-markdown/load-catalog.js';
// Skill markdown preprocessor: `{@tool …}` / `{@skill …}` resolution and tagged-example
// validation. Pure — the consuming build supplies the catalog and the schema validator.
export {
    assertSkillMarkdown,
    DEFAULT_SKILL_TOOL_PREFIX,
    type PreprocessSkillMarkdownOptions,
    type PreprocessSkillMarkdownResult,
    preprocessSkillMarkdown,
    type SkillExample,
    type SkillReference,
    type SkillReferenceKind,
} from './core/skill-markdown/preprocess.js';
export {
    checkDispatchDescriptor,
    createSchemaExampleValidator,
    type DispatchResolution,
    nodesAtPath,
    pairDispatchedInputs,
    resolveDispatchedNames,
    schemaNodeAtPath,
    type ToolDispatchDescriptor,
    type ToolSchemaEntry,
    toolNamesAtPath,
} from './core/skill-markdown/schema-validator.js';
// Transformers (the pure transformation functions)
export {
    createSkillTransformer,
    isSkillTransformer,
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
    type SkillTransformerConfig,
    skillCollectionTransformer,
    skillTransformer,
    TemplateType,
    templateCollectionTransformer,
    templateTransformer,
} from './core/transformers/index.js';
// Types
export type {
    AssetFile,
    TransformerPreset,
    TransformerRule,
    TransformFunction,
    TransformResult,
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
