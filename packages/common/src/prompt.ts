import type { JSONSchema, PromptRole } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    PromptTemplateCreatePayloadSchema,
    PromptTemplateRefSchema,
    PromptTemplateSchema,
    PromptTemplateUpdatePayloadSchema,
} from './api-schemas/interaction.js';

export interface ChatPromptSchema {
    role: PromptRole.user | PromptRole.assistant;
    content: string;
}

export enum PromptStatus {
    draft = 'draft',
    published = 'published',
    archived = 'archived',
}

export enum PromptSegmentDefType {
    chat = 'chat',
    template = 'template',
}

export interface PromptSegmentDef<T = string | PromptTemplate | PromptTemplateRef> {
    id?: string;
    type: PromptSegmentDefType;
    template?: T; // the template id in case of a prompt template
    configuration?: unknown; // the configuration if any in case of builtin prompts
}

export interface PromptSegmentRef<T = string | PromptTemplate | PromptTemplateRef> extends PromptSegmentDef<T> {
    id: string;
}

export interface PopulatedPromptSegmentDef extends Omit<PromptSegmentDef, 'template'> {
    template?: PromptTemplate;
}
/**
 * Used for prompt rendering at interaction execution
 */
export interface ExecutablePromptSegmentDef extends Omit<PromptSegmentDef, 'template'> {
    template?: ExecutablePromptTemplate;
}

export type PromptTemplateRef = z.infer<typeof PromptTemplateRefSchema>;

export interface PromptTemplateRefWithSchema extends PromptTemplateRef {
    inputSchema?: JSONSchema;
}

export enum TemplateType {
    jst = 'jst',
    handlebars = 'handlebars',
    text = 'text',
}
export interface ExecutablePromptTemplate {
    role: PromptRole;
    content: string;
    content_type: TemplateType;
    inputSchema?: JSONSchema;
}
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export interface PromptTemplateForkPayload {
    keepTags?: boolean;
    targetProject?: string;
}

export type PromptTemplateCreatePayload = z.infer<typeof PromptTemplateCreatePayloadSchema>;

export type PromptTemplateUpdatePayload = z.infer<typeof PromptTemplateUpdatePayloadSchema>;

export interface PromptTemplateInteractionVersion {
    version: number;
}

export interface PromptTemplateInteractionUsage {
    id: string;
    name: string;
    versions: PromptTemplateInteractionVersion[];
}

export interface PromptTemplateInteractionsResponse {
    prompt: string;
    interactions: PromptTemplateInteractionUsage[];
}
