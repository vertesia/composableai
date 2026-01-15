/**
 * Prompt transformer preset for template files with frontmatter
 * Supports .jst, .hbs, and plain text files
 */

import { z } from 'zod';
import type { TransformerPreset } from '../types.js';
import { parseFrontmatter } from '../parsers/frontmatter.js';
import path from 'path';

/**
 * Template type for prompt content
 * MUST match TemplateType from @vertesia/common
 */
export enum TemplateType {
    jst = "jst",
    handlebars = "handlebars",
    text = "text",
}

/**
 * Template type alias
 */
export type PromptContentType = TemplateType;

/**
 * Prompt role enum
 * MUST match PromptRole from @llumiverse/common
 */
export enum PromptRole {
    safety = "safety",
    system = "system",
    user = "user",
    assistant = "assistant",
    negative = "negative",
}

/**
 * Zod schema for prompt frontmatter validation
 */
const PromptFrontmatterSchema = z.object({
    // Required fields
    role: z.nativeEnum(PromptRole, {
        errorMap: () => ({ message: 'Role must be one of: safety, system, user, assistant, negative' })
    }),

    // Optional fields
    content_type: z.nativeEnum(TemplateType).optional(),
    schema: z.string().optional(),
    name: z.string().optional(),
    externalId: z.string().optional(),
}).strict();

/**
 * MUST be kept in sync with @vertesia/common InCodePrompt
 * Zod schema for prompt definition
 */
export const PromptDefinitionSchema = z.object({
    role: z.nativeEnum(PromptRole),
    content: z.string(),
    content_type: z.nativeEnum(TemplateType),
    schema: z.any().optional(),
    name: z.string().optional(),
    externalId: z.string().optional(),
});

/**
 * TypeScript type inferred from the Zod schema
 */
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;

/**
 * Normalize schema path for import
 * - Adds './' prefix if not a relative path
 * - Replaces .ts with .js
 * - Adds .js if no extension
 *
 * @param schemaPath - Original schema path from frontmatter
 * @returns Normalized path for ES module import
 */
function normalizeSchemaPath(schemaPath: string): string {
    let normalized = schemaPath.trim();

    // Add './' prefix if not already a relative path
    if (!normalized.startsWith('.')) {
        normalized = './' + normalized;
    }

    // Get the extension
    const ext = path.extname(normalized);

    if (ext === '.ts') {
        // Replace .ts with .js
        normalized = normalized.slice(0, -3) + '.js';
    } else if (!ext) {
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
function inferContentType(filePath: string): TemplateType {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        case '.jst':
            return TemplateType.jst;
        case '.hbs':
            return TemplateType.handlebars;
        default:
            return TemplateType.text;
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
function buildPromptDefinition(
    frontmatter: Record<string, any>,
    content: string,
    filePath: string
): { prompt: PromptDefinition; imports?: string[]; schemaImportName?: string } {
    // Determine content type from frontmatter or file extension
    const content_type: TemplateType =
        frontmatter.content_type || inferContentType(filePath);

    const prompt: PromptDefinition = {
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
    let imports: string[] | undefined;
    let schemaImportName: string | undefined;

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
export const promptTransformer: TransformerPreset = {
    pattern: /\?prompt$/,
    schema: PromptDefinitionSchema,
    transform: (content: string, filePath: string) => {
        const { frontmatter, content: promptContent } = parseFrontmatter(content);

        // Validate frontmatter
        const frontmatterValidation = PromptFrontmatterSchema.safeParse(frontmatter);
        if (!frontmatterValidation.success) {
            const errors = frontmatterValidation.error.errors
                .map((err) => {
                    const path = err.path.length > 0 ? err.path.join('.') : 'frontmatter';
                    return `  - ${path}: ${err.message}`;
                })
                .join('\n');
            throw new Error(
                `Invalid frontmatter in ${filePath}:\n${errors}`
            );
        }

        // Build prompt definition
        const { prompt, imports, schemaImportName } = buildPromptDefinition(
            frontmatter,
            promptContent,
            filePath
        );

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
