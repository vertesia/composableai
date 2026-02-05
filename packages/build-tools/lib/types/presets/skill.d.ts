/**
 * Skill transformer preset for markdown files with frontmatter
 */
import { z } from 'zod';
import type { TransformerPreset } from '../types.js';
/**
 * Content type for skill instructions
 */
export type SkillContentType = 'md' | 'jst';
/**
 * MUST be kept in sync with @vertesia/tools-sdk SkillDefinition
 * Zod schema for skill definition
 * This validates the structure of skill objects generated from markdown
 * Matches the SkillDefinition interface from @vertesia/tools-sdk
 */
export declare const SkillDefinitionSchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    instructions: z.ZodString;
    content_type: z.ZodEnum<["md", "jst"]>;
    input_schema: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties?: Record<string, any> | undefined;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties?: Record<string, any> | undefined;
        required?: string[] | undefined;
    }>>;
    context_triggers: z.ZodOptional<z.ZodObject<{
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        tool_names: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        data_patterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        keywords?: string[] | undefined;
        tool_names?: string[] | undefined;
        data_patterns?: string[] | undefined;
    }, {
        keywords?: string[] | undefined;
        tool_names?: string[] | undefined;
        data_patterns?: string[] | undefined;
    }>>;
    execution: z.ZodOptional<z.ZodObject<{
        language: z.ZodString;
        packages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        system_packages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        template: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        language: string;
        packages?: string[] | undefined;
        system_packages?: string[] | undefined;
        template?: string | undefined;
    }, {
        language: string;
        packages?: string[] | undefined;
        system_packages?: string[] | undefined;
        template?: string | undefined;
    }>>;
    related_tools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scripts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    widgets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    content_type: "md" | "jst";
    instructions: string;
    scripts?: string[] | undefined;
    widgets?: string[] | undefined;
    title?: string | undefined;
    context_triggers?: {
        keywords?: string[] | undefined;
        tool_names?: string[] | undefined;
        data_patterns?: string[] | undefined;
    } | undefined;
    execution?: {
        language: string;
        packages?: string[] | undefined;
        system_packages?: string[] | undefined;
        template?: string | undefined;
    } | undefined;
    related_tools?: string[] | undefined;
    input_schema?: {
        type: "object";
        properties?: Record<string, any> | undefined;
        required?: string[] | undefined;
    } | undefined;
}, {
    name: string;
    description: string;
    content_type: "md" | "jst";
    instructions: string;
    scripts?: string[] | undefined;
    widgets?: string[] | undefined;
    title?: string | undefined;
    context_triggers?: {
        keywords?: string[] | undefined;
        tool_names?: string[] | undefined;
        data_patterns?: string[] | undefined;
    } | undefined;
    execution?: {
        language: string;
        packages?: string[] | undefined;
        system_packages?: string[] | undefined;
        template?: string | undefined;
    } | undefined;
    related_tools?: string[] | undefined;
    input_schema?: {
        type: "object";
        properties?: Record<string, any> | undefined;
        required?: string[] | undefined;
    } | undefined;
}>;
/**
 * TypeScript type inferred from the Zod schema
 * Can also be imported from consumer packages for type safety
 */
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
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
export declare const skillTransformer: TransformerPreset;
//# sourceMappingURL=skill.d.ts.map