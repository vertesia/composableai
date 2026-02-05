"use strict";
/**
 * Prompt transformer preset for template files with frontmatter
 * Supports .jst, .hbs, and plain text files
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptTransformer = exports.PromptDefinitionSchema = exports.PromptRole = exports.TemplateType = void 0;
const zod_1 = require("zod");
const frontmatter_js_1 = require("../parsers/frontmatter.js");
const path_1 = __importDefault(require("path"));
const common_1 = require("@vertesia/common");
Object.defineProperty(exports, "TemplateType", { enumerable: true, get: function () { return common_1.TemplateType; } });
const common_2 = require("@llumiverse/common");
Object.defineProperty(exports, "PromptRole", { enumerable: true, get: function () { return common_2.PromptRole; } });
/**
 * Zod schema for prompt frontmatter validation
 */
const PromptFrontmatterSchema = zod_1.z.object({
    // Required fields
    role: zod_1.z.nativeEnum(common_2.PromptRole, {
        errorMap: () => ({ message: 'Role must be one of: safety, system, user, assistant, negative' })
    }),
    // Optional fields
    content_type: zod_1.z.nativeEnum(common_1.TemplateType).optional(),
    schema: zod_1.z.string().optional(),
    name: zod_1.z.string().optional(),
    externalId: zod_1.z.string().optional(),
}).strict();
/**
 * MUST be kept in sync with @vertesia/common InCodePrompt
 * Zod schema for prompt definition
 */
exports.PromptDefinitionSchema = zod_1.z.object({
    role: zod_1.z.nativeEnum(common_2.PromptRole),
    content: zod_1.z.string(),
    content_type: zod_1.z.nativeEnum(common_1.TemplateType),
    schema: zod_1.z.any().optional(),
    name: zod_1.z.string().optional(),
    externalId: zod_1.z.string().optional(),
});
/**
 * Normalize schema path for import
 * - Adds './' prefix if not a relative path
 * - Replaces .ts with .js
 * - Adds .js if no extension
 *
 * @param schemaPath - Original schema path from frontmatter
 * @returns Normalized path for ES module import
 */
function normalizeSchemaPath(schemaPath) {
    let normalized = schemaPath.trim();
    // Add './' prefix if not already a relative path
    if (!normalized.startsWith('.')) {
        normalized = './' + normalized;
    }
    // Get the extension
    const ext = path_1.default.extname(normalized);
    if (ext === '.ts') {
        // Replace .ts with .js
        normalized = normalized.slice(0, -3) + '.js';
    }
    else if (!ext) {
        // No extension, add .js
        normalized = normalized + '.js';
    }
    // If extension is already .js or something else, leave as is
    return normalized;
}
/**
 * Infer content type from file extension
 *
 * @param filePath - Path to the prompt file
 * @returns Inferred content type
 */
function inferContentType(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jst':
            return common_1.TemplateType.jst;
        case '.hbs':
            return common_1.TemplateType.handlebars;
        default:
            return common_1.TemplateType.text;
    }
}
/**
 * Build a PromptDefinition from frontmatter and content
 *
 * @param frontmatter - Parsed frontmatter object
 * @param content - Prompt content (body of the file)
 * @param filePath - Path to the prompt file (for content type inference)
 * @returns Prompt definition object and optional imports
 */
function buildPromptDefinition(frontmatter, content, filePath) {
    // Determine content type from frontmatter or file extension
    const content_type = frontmatter.content_type || inferContentType(filePath);
    const prompt = {
        role: frontmatter.role,
        content,
        content_type,
    };
    // Add optional fields
    if (frontmatter.name) {
        prompt.name = frontmatter.name;
    }
    if (frontmatter.externalId) {
        prompt.externalId = frontmatter.externalId;
    }
    // Handle schema import if specified
    let imports;
    let schemaImportName;
    if (frontmatter.schema) {
        const normalizedPath = normalizeSchemaPath(frontmatter.schema);
        schemaImportName = '__promptSchema';
        imports = [`import ${schemaImportName} from '${normalizedPath}';`];
    }
    return { prompt, imports, schemaImportName };
}
/**
 * Prompt transformer preset
 * Transforms template files with ?prompt suffix into prompt definition objects
 *
 * Supported file types:
 * - .jst (JavaScript template literals) → content_type: 'jst'
 * - .hbs (Handlebars templates) → content_type: 'handlebars'
 * - .txt or other → content_type: 'text'
 *
 * @example
 * ```typescript
 * import PROMPT from './prompt.hbs?prompt';
 * // PROMPT is an InCodePrompt object
 * ```
 */
exports.promptTransformer = {
    pattern: /\?prompt$/,
    schema: exports.PromptDefinitionSchema,
    transform: (content, filePath) => {
        const { frontmatter, content: promptContent } = (0, frontmatter_js_1.parseFrontmatter)(content);
        // Validate frontmatter
        const frontmatterValidation = PromptFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                const path = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                return `  - ${path}: ${err.message}`;
            })
                .join('\n');
            throw new Error(`Invalid frontmatter in ${filePath}:\n${errors}`);
        }
        // Build prompt definition
        const { prompt, imports, schemaImportName } = buildPromptDefinition(frontmatter, promptContent, filePath);
        // If schema is specified, generate custom code with schema reference
        if (schemaImportName) {
            // Build the code manually to avoid JSON.stringify issues with schema reference
            const lines = [
                'export default {',
                `  role: "${prompt.role}",`,
                `  content: ${JSON.stringify(prompt.content)},`,
                `  content_type: "${prompt.content_type}",`,
                `  schema: ${schemaImportName}`,
            ];
            if (prompt.name) {
                lines.splice(4, 0, `  name: ${JSON.stringify(prompt.name)},`);
            }
            if (prompt.externalId) {
                lines.splice(4, 0, `  externalId: ${JSON.stringify(prompt.externalId)},`);
            }
            lines.push('};');
            const code = lines.join('\n');
            return {
                data: prompt,
                imports,
                code,
            };
        }
        // Standard case without schema
        return {
            data: prompt,
        };
    }
};
//# sourceMappingURL=prompt.js.map