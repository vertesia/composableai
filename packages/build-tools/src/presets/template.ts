/**
 * Template transformer preset for markdown files with frontmatter
 */

import path from 'node:path';
import { z } from 'zod';
import type { TransformerPreset } from '../types.js';
import { parseFrontmatter } from '../parsers/frontmatter.js';
import { discoverTemplateAssets } from '../utils/template-asset-discovery.js';

/**
 * Zod schema for template frontmatter validation.
 * Only includes fields authored by the user.
 * The name and id are inferred from the directory structure.
 */
const TemplateFrontmatterSchema = z.object({
    title: z.string().optional(),
    description: z.string().min(1, 'Template description is required'),
    tags: z.array(z.string()).optional(),
    type: z.enum(['presentation', 'document']),
}).strict();

/**
 * MUST be kept in sync with @vertesia/tools-sdk TemplateDefinition
 * Zod schema for template definition
 */
export const TemplateDefinitionSchema = z.object({
    id: z.string().min(1, 'Template id is required'),
    name: z.string().min(1, 'Template name is required'),
    title: z.string().optional(),
    description: z.string().min(1, 'Template description is required'),
    instructions: z.string(),
    tags: z.array(z.string()).optional(),
    type: z.enum(['presentation', 'document']),
    assets: z.array(z.string()),
}).passthrough();

/**
 * TypeScript type inferred from the Zod schema
 */
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;

/**
 * Derive the template path segments from the file path.
 *
 * Example: .../templates/examples/report/TEMPLATE.md
 *   → category: "examples", name: "report", relative: "examples/report"
 */
function deriveTemplatePathInfo(filePath: string): { category: string; templateName: string; relative: string } {
    const templateDir = path.dirname(filePath);
    const templateName = path.basename(templateDir);
    const collectionDir = path.dirname(templateDir);
    const category = path.basename(collectionDir);
    return { category, templateName, relative: `${category}/${templateName}` };
}

/**
 * Template transformer preset
 * Transforms markdown files with ?template suffix OR TEMPLATE.md files into template definition objects
 *
 * Matches:
 * - Files with ?template suffix: ./my-template.md?template
 * - TEMPLATE.md files: ./my-template/TEMPLATE.md
 *
 * @example
 * ```typescript
 * import template1 from './my-template.md?template';
 * import template2 from './my-template/TEMPLATE.md';
 * // Both are TemplateDefinition objects
 * ```
 */
export const templateTransformer: TransformerPreset = {
    pattern: /(\.md\?template$|\/TEMPLATE\.md$)/,
    schema: TemplateDefinitionSchema,
    transform: (content: string, filePath: string) => {
        const { frontmatter, content: markdown } = parseFrontmatter(content);

        // Validate frontmatter
        const frontmatterValidation = TemplateFrontmatterSchema.safeParse(frontmatter);
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

        // Derive template path from directory structure
        const { category, templateName, relative: templatePath } = deriveTemplatePathInfo(filePath);

        // Discover asset files in the template directory
        const assets = discoverTemplateAssets(filePath, templatePath);

        // Build template definition
        // Assets use absolute paths for direct server-side resolution
        const templateData: TemplateDefinition = {
            id: `${category}:${templateName}`,
            name: templateName,
            title: frontmatter.title,
            description: frontmatter.description,
            instructions: markdown,
            tags: frontmatter.tags,
            type: frontmatter.type,
            assets: assets.fileNames.map(f => `/templates/${templatePath}/${f}`),
        };

        return {
            data: templateData,
            assets: assets.assetFiles,
        };
    }
};
