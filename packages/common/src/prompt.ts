import type { JSONSchema, PromptRole } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    ExportedPromptTemplateRefSchema,
    InteractionPromptSegmentInputSchema,
    InteractionPromptTemplateInputSchema,
    PromptTemplateCreatePayloadSchema,
    PromptTemplateRefSchema,
    PromptTemplateSchema,
    PromptTemplateUpdatePayloadSchema,
} from './api-schemas/interaction.js';
import type {
    PromptTemplateForkPayloadSchema,
    PromptTemplateInteractionsResponseSchema,
    PromptTemplateInteractionUsageSchema,
    PromptTemplateInteractionVersionSchema,
    RenderPromptPayloadSchema,
    RenderPromptResponseSchema,
} from './api-schemas/prompt.js';

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

export type InteractionPromptTemplateInput = z.infer<typeof InteractionPromptTemplateInputSchema>;

export type InteractionPromptSegmentInput = z.infer<typeof InteractionPromptSegmentInputSchema>;

export type PromptTemplateForkPayload = z.infer<typeof PromptTemplateForkPayloadSchema>;

export type PromptTemplateCreatePayload = z.infer<typeof PromptTemplateCreatePayloadSchema>;

export type PromptTemplateUpdatePayload = z.infer<typeof PromptTemplateUpdatePayloadSchema>;

export type PromptTemplateInteractionVersion = z.infer<typeof PromptTemplateInteractionVersionSchema>;

export type PromptTemplateInteractionUsage = z.infer<typeof PromptTemplateInteractionUsageSchema>;

export type PromptTemplateInteractionsResponse = z.infer<typeof PromptTemplateInteractionsResponseSchema>;

export type RenderPromptPayload = z.infer<typeof RenderPromptPayloadSchema>;

/**
 * What `POST /prompts/:id/render` answers with: the segment identity plus the rendered body.
 *
 * Stated here for the first time — the endpoint declared its response inline, so there has never
 * been a name for it on either side of the wire.
 */
export type RenderPromptResponse = z.infer<typeof RenderPromptResponseSchema>;

export type ExportedPromptTemplateRef = z.infer<typeof ExportedPromptTemplateRefSchema>;
