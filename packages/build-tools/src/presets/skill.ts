/**
 * Skill transformer preset for markdown files with frontmatter
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import type { TransformerPreset } from '../types.js';
import { parseFrontmatter } from '../parsers/frontmatter.js';
import { discoverSkillAssets } from '../utils/asset-discovery.js';

/**
 * Content type for skill instructions
 */
export type SkillContentType = 'md' | 'jst';

/**
 * Context triggers for auto-injection of skills (for frontmatter validation)
 */
const SkillContextTriggersFrontmatterSchema = z.object({
    keywords: z.array(z.string()).optional(),
    tool_names: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional()
}).strict();

/**
 * Context triggers for auto-injection of skills (for output validation)
 */
const SkillContextTriggersSchema = z.object({
    keywords: z.array(z.string()).optional(),
    tool_names: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional()
}).optional();

/**
 * Execution configuration for skills that need code execution (for frontmatter validation)
 */
const SkillExecutionFrontmatterSchema = z.object({
    language: z.string(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),
    template: z.string().optional()
}).strict();

/**
 * Execution configuration for skills that need code execution (for output validation)
 */
const SkillExecutionSchema = z.object({
    language: z.string(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),
    template: z.string().optional()
}).optional();

/**
 * Zod schema for skill frontmatter validation
 * This validates the YAML frontmatter before transformation
 * Supports both flat and nested structures
 */
const SkillFrontmatterSchema = z.object({
    // Required fields
    name: z.string().min(1, 'Skill name is required'),
    description: z.string().min(1, 'Skill description is required'),

    // Optional fields
    title: z.string().optional(),
    content_type: z.enum(['md', 'jst']).optional(),

    // Flat structure fields (legacy)
    keywords: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    data_patterns: z.array(z.string()).optional(),
    language: z.string().optional(),
    packages: z.array(z.string()).optional(),
    system_packages: z.array(z.string()).optional(),

    // Nested structure fields
    context_triggers: SkillContextTriggersFrontmatterSchema.optional(),
    execution: SkillExecutionFrontmatterSchema.optional(),
    related_tools: z.array(z.string()).optional(),
    input_schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional()
    }).optional(),

    // Asset fields (auto-discovered but can be overridden)
    scripts: z.array(z.string()).optional(),
    widgets: z.array(z.string()).optional()
}).strict();

/**
 * MUST be kept in sync with @vertesia/tools-sdk SkillDefinition
 * Zod schema for skill definition
 * This validates the structure of skill objects generated from markdown
 * Matches the SkillDefinition interface from @vertesia/tools-sdk
 *
 * Note: The isEnabled property is not included in this schema because Zod cannot
 * properly validate function signatures. It will be type-checked by TypeScript instead.
 */
export const SkillDefinitionSchema = z.object({
    name: z.string().min(1, 'Skill name is required'),
    title: z.string().optional(),
    description: z.string().min(1, 'Skill description is required'),
    instructions: z.string(),
    content_type: z.enum(['md', 'jst']),
    input_schema: z.object({
        type: z.literal('object'),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional()
    }).optional(),
    context_triggers: SkillContextTriggersSchema,
    execution: SkillExecutionSchema,
    related_tools: z.array(z.string()).optional(),
    scripts: z.array(z.string()).optional(),
    widgets: z.array(z.string()).optional()
}).passthrough();

/**
 * Schema for validating properties exported from properties.ts
 * This is a partial schema - allows any subset of SkillDefinition fields
 *
 * Note: Function properties like isEnabled cannot be validated by Zod for their signatures.
 * Zod will only check that they are functions, not their specific parameter/return types.
 * Use TypeScript for proper type checking of function signatures.
 */
export const SkillPropertiesSchema = SkillDefinitionSchema.partial().passthrough();

/**
 * TypeScript type inferred from the Zod schema
 * Can also be imported from consumer packages for type safety
 */
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/**
 * Build a SkillDefinition from frontmatter and markdown content.
 * This mirrors the logic in @vertesia/tools-sdk parseSkillFile function.
 *
 * Supports two frontmatter structures:
 *
 * 1. Flat structure (matches parseSkillFile in tools-sdk):
 *    keywords: [...]
 *    tools: [...]
 *    language: python
 *    packages: [...]
 *
 * 2. Nested structure (for more explicit YAML):
 *    context_triggers:
 *      keywords: [...]
 *      tool_names: [...]
 *    execution:
 *      language: python
 *      packages: [...]
 *    related_tools: [...]
 *
 * @param frontmatter - Parsed frontmatter object
 * @param instructions - Markdown content (body of the file)
 * @param contentType - Content type ('md' or 'jst')
 * @param widgets - Discovered widget names
 * @param scripts - Discovered script names
 * @returns Skill definition object
 */
function buildSkillDefinition(
    frontmatter: Record<string, any>,
    instructions: string,
    contentType: SkillContentType,
    widgets: string[],
    scripts: string[]
): SkillDefinition {
    const skill: SkillDefinition = {
        name: frontmatter.name,
        title: frontmatter.title,
        description: frontmatter.description,
        instructions,
        content_type: contentType,
        widgets: widgets.length > 0 ? widgets : undefined,
        scripts: scripts.length > 0 ? scripts : undefined,
    };

    // Build context triggers - support both flat and nested structure
    // Nested: context_triggers: { keywords: [...], tool_names: [...] }
    // Flat: keywords: [...], tools: [...]
    const contextTriggers = frontmatter.context_triggers;
    const hasNestedTriggers = contextTriggers && typeof contextTriggers === 'object';
    const hasFlatTriggers = frontmatter.keywords || frontmatter.tools || frontmatter.data_patterns;

    if (hasNestedTriggers || hasFlatTriggers) {
        skill.context_triggers = {
            keywords: hasNestedTriggers ? contextTriggers.keywords : frontmatter.keywords,
            tool_names: hasNestedTriggers ? contextTriggers.tool_names : frontmatter.tools,
            data_patterns: hasNestedTriggers ? contextTriggers.data_patterns : frontmatter.data_patterns,
        };
    }

    // Build execution config - support both flat and nested structure
    const execution = frontmatter.execution;
    const hasNestedExecution = execution && typeof execution === 'object';
    const hasFlatExecution = frontmatter.language;

    if (hasNestedExecution || hasFlatExecution) {
        skill.execution = {
            language: hasNestedExecution ? execution.language : frontmatter.language,
            packages: hasNestedExecution ? execution.packages : frontmatter.packages,
            system_packages: hasNestedExecution ? execution.system_packages : frontmatter.system_packages,
        };

        // Extract code template from instructions if present
        const codeBlockMatch = instructions.match(/```(?:python|javascript|typescript|js|ts|py)\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            skill.execution.template = codeBlockMatch[1].trim();
        }
    }

    // Related tools - support both direct field and from tools field
    if (frontmatter.related_tools) {
        skill.related_tools = frontmatter.related_tools;
    } else if (frontmatter.tools && !hasNestedTriggers) {
        // If tools is not part of context_triggers, use it as related_tools
        skill.related_tools = frontmatter.tools;
    }

    // Input schema from frontmatter
    if (frontmatter.input_schema) {
        skill.input_schema = frontmatter.input_schema;
    }

    return skill;
}

/**
 * Skill transformer preset
 * Transforms markdown files with ?skill suffix OR SKILL.md files into skill definition objects
 *
 * Matches:
 * - Files with ?skill suffix: ./my-skill.md?skill
 * - SKILL.md files: ./my-skill/SKILL.md
 *
 * Runtime Properties:
 * - Supports properties.ts file in skill directory for runtime properties (functions, overrides)
 * - Properties from properties.ts override those from frontmatter
 * - See README.md for detailed usage examples
 *
 * @example
 * ```typescript
 * import skill1 from './my-skill.md?skill';
 * import skill2 from './my-skill/SKILL.md';
 * // Both are SkillDefinition objects
 * ```
 */
export const skillTransformer: TransformerPreset = {
    pattern: /(\.md\?skill$|\/SKILL\.md$)/,
    schema: SkillDefinitionSchema,
    transform: (content: string, filePath: string) => {
        const { frontmatter, content: markdown } = parseFrontmatter(content);

        // Validate frontmatter first to catch unknown properties
        const frontmatterValidation = SkillFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                    const pathStr = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                    return `  - ${pathStr}: ${err.message}`;
                })
                .join('\n');
            throw new Error(
                `Invalid frontmatter in ${filePath}:\n${errors}`
            );
        }

        // Determine content type from frontmatter or file extension
        const content_type: SkillContentType = frontmatter.content_type || 'md';

        // Discover assets (scripts and widgets) in the skill directory
        const assets = discoverSkillAssets(filePath);

        // Build skill definition using the same logic as parseSkillFile in tools-sdk
        const skillData = buildSkillDefinition(
            frontmatter,
            markdown,
            content_type,
            assets.widgets,
            assets.scripts
        );

        // Check if properties.ts exists in the skill directory
        const skillDir = path.dirname(filePath);
        const propertiesPath = path.join(skillDir, 'properties.ts');
        const hasProperties = existsSync(propertiesPath);

        // If properties.ts exists, generate custom code with import and merge
        // Rollup will handle transpiling properties.ts to properties.js
        if (hasProperties) {
            const skillDataJson = JSON.stringify(skillData, null, 2);
            const code = `import properties from './properties.js';

// Runtime validation for function properties
if ('isEnabled' in properties && typeof properties.isEnabled !== 'function') {
  throw new Error('properties.isEnabled must be a function, got ' + typeof properties.isEnabled);
}

const skill = ${skillDataJson};

export default { ...skill, ...properties };
`;
            return {
                data: skillData,
                assets: assets.assetFiles,
                widgets: assets.widgetMetadata,
                code
            };
        }

        return {
            data: skillData,
            assets: assets.assetFiles,
            widgets: assets.widgetMetadata
        };
    }
};
