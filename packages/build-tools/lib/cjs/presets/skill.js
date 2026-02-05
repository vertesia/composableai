"use strict";
/**
 * Skill transformer preset for markdown files with frontmatter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillTransformer = exports.SkillDefinitionSchema = void 0;
const zod_1 = require("zod");
const frontmatter_js_1 = require("../parsers/frontmatter.js");
const asset_discovery_js_1 = require("../utils/asset-discovery.js");
/**
 * Context triggers for auto-injection of skills (for frontmatter validation)
 */
const SkillContextTriggersFrontmatterSchema = zod_1.z.object({
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    tool_names: zod_1.z.array(zod_1.z.string()).optional(),
    data_patterns: zod_1.z.array(zod_1.z.string()).optional()
}).strict();
/**
 * Context triggers for auto-injection of skills (for output validation)
 */
const SkillContextTriggersSchema = zod_1.z.object({
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    tool_names: zod_1.z.array(zod_1.z.string()).optional(),
    data_patterns: zod_1.z.array(zod_1.z.string()).optional()
}).optional();
/**
 * Execution configuration for skills that need code execution (for frontmatter validation)
 */
const SkillExecutionFrontmatterSchema = zod_1.z.object({
    language: zod_1.z.string(),
    packages: zod_1.z.array(zod_1.z.string()).optional(),
    system_packages: zod_1.z.array(zod_1.z.string()).optional(),
    template: zod_1.z.string().optional()
}).strict();
/**
 * Execution configuration for skills that need code execution (for output validation)
 */
const SkillExecutionSchema = zod_1.z.object({
    language: zod_1.z.string(),
    packages: zod_1.z.array(zod_1.z.string()).optional(),
    system_packages: zod_1.z.array(zod_1.z.string()).optional(),
    template: zod_1.z.string().optional()
}).optional();
/**
 * Zod schema for skill frontmatter validation
 * This validates the YAML frontmatter before transformation
 * Supports both flat and nested structures
 */
const SkillFrontmatterSchema = zod_1.z.object({
    // Required fields
    name: zod_1.z.string().min(1, 'Skill name is required'),
    description: zod_1.z.string().min(1, 'Skill description is required'),
    // Optional fields
    title: zod_1.z.string().optional(),
    content_type: zod_1.z.enum(['md', 'jst']).optional(),
    // Flat structure fields (legacy)
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    tools: zod_1.z.array(zod_1.z.string()).optional(),
    data_patterns: zod_1.z.array(zod_1.z.string()).optional(),
    language: zod_1.z.string().optional(),
    packages: zod_1.z.array(zod_1.z.string()).optional(),
    system_packages: zod_1.z.array(zod_1.z.string()).optional(),
    // Nested structure fields
    context_triggers: SkillContextTriggersFrontmatterSchema.optional(),
    execution: SkillExecutionFrontmatterSchema.optional(),
    related_tools: zod_1.z.array(zod_1.z.string()).optional(),
    input_schema: zod_1.z.object({
        type: zod_1.z.literal('object'),
        properties: zod_1.z.record(zod_1.z.any()).optional(),
        required: zod_1.z.array(zod_1.z.string()).optional()
    }).optional(),
    // Asset fields (auto-discovered but can be overridden)
    scripts: zod_1.z.array(zod_1.z.string()).optional(),
    widgets: zod_1.z.array(zod_1.z.string()).optional()
}).strict();
/**
 * MUST be kept in sync with @vertesia/tools-sdk SkillDefinition
 * Zod schema for skill definition
 * This validates the structure of skill objects generated from markdown
 * Matches the SkillDefinition interface from @vertesia/tools-sdk
 */
exports.SkillDefinitionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Skill name is required'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().min(1, 'Skill description is required'),
    instructions: zod_1.z.string(),
    content_type: zod_1.z.enum(['md', 'jst']),
    input_schema: zod_1.z.object({
        type: zod_1.z.literal('object'),
        properties: zod_1.z.record(zod_1.z.any()).optional(),
        required: zod_1.z.array(zod_1.z.string()).optional()
    }).optional(),
    context_triggers: SkillContextTriggersSchema,
    execution: SkillExecutionSchema,
    related_tools: zod_1.z.array(zod_1.z.string()).optional(),
    scripts: zod_1.z.array(zod_1.z.string()).optional(),
    widgets: zod_1.z.array(zod_1.z.string()).optional()
});
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
function buildSkillDefinition(frontmatter, instructions, contentType, widgets, scripts) {
    const skill = {
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
    }
    else if (frontmatter.tools && !hasNestedTriggers) {
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
 * @example
 * ```typescript
 * import skill1 from './my-skill.md?skill';
 * import skill2 from './my-skill/SKILL.md';
 * // Both are SkillDefinition objects
 * ```
 */
exports.skillTransformer = {
    pattern: /(\.md\?skill$|\/SKILL\.md$)/,
    schema: exports.SkillDefinitionSchema,
    transform: (content, filePath) => {
        const { frontmatter, content: markdown } = (0, frontmatter_js_1.parseFrontmatter)(content);
        // Validate frontmatter first to catch unknown properties
        const frontmatterValidation = SkillFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                const path = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                return `  - ${path}: ${err.message}`;
            })
                .join('\n');
            throw new Error(`Invalid frontmatter in ${filePath}:\n${errors}`);
        }
        // Determine content type from frontmatter or file extension
        const content_type = frontmatter.content_type || 'md';
        // Discover assets (scripts and widgets) in the skill directory
        const assets = (0, asset_discovery_js_1.discoverSkillAssets)(filePath);
        // Build skill definition using the same logic as parseSkillFile in tools-sdk
        const skillData = buildSkillDefinition(frontmatter, markdown, content_type, assets.widgets, assets.scripts);
        return {
            data: skillData,
            assets: assets.assetFiles,
            widgets: assets.widgetMetadata
        };
    }
};
//# sourceMappingURL=skill.js.map