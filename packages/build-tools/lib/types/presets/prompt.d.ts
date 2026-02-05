/**
 * Prompt transformer preset for template files with frontmatter
 * Supports .jst, .hbs, and plain text files
 */
import { z } from 'zod';
import type { TransformerPreset } from '../types.js';
import { TemplateType } from '@vertesia/common';
import { PromptRole } from '@llumiverse/common';
/**
 * Re-export types for backwards compatibility
 */
export { TemplateType, PromptRole };
/**
 * Template type alias
 */
export type PromptContentType = TemplateType;
/**
 * MUST be kept in sync with @vertesia/common InCodePrompt
 * Zod schema for prompt definition
 */
export declare const PromptDefinitionSchema: z.ZodObject<{
    role: z.ZodNativeEnum<typeof PromptRole>;
    content: z.ZodString;
    content_type: z.ZodNativeEnum<typeof TemplateType>;
    schema: z.ZodOptional<z.ZodAny>;
    name: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content_type: TemplateType;
    content: string;
    role: PromptRole;
    schema?: any;
    name?: string | undefined;
    externalId?: string | undefined;
}, {
    content_type: TemplateType;
    content: string;
    role: PromptRole;
    schema?: any;
    name?: string | undefined;
    externalId?: string | undefined;
}>;
/**
 * TypeScript type inferred from the Zod schema
 */
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;
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
export declare const promptTransformer: TransformerPreset;
//# sourceMappingURL=prompt.d.ts.map