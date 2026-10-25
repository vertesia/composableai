import type { JSONSchema, PromptRole } from '@llumiverse/common';
import type * as Wire from './wire-types.generated.js';

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

export type PromptTemplateRef = Wire.PromptTemplateRef;

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
export type PromptTemplate = Wire.PromptTemplate;

export type InteractionPromptTemplateInput = Wire.InteractionPromptTemplateInput;

export type InteractionPromptSegmentInput = Wire.InteractionPromptSegmentInput;

export type PromptTemplateForkPayload = Wire.PromptTemplateForkPayload;

export type PromptTemplateCreatePayload = Wire.PromptTemplateCreatePayload;

export type PromptTemplateUpdatePayload = Wire.PromptTemplateUpdatePayload;

export type PromptTemplateInteractionVersion = Wire.PromptTemplateInteractionVersion;

export type PromptTemplateInteractionUsage = Wire.PromptTemplateInteractionUsage;

export type PromptTemplateInteractionsResponse = Wire.PromptTemplateInteractionsResponse;

export type RenderPromptPayload = Wire.RenderPromptPayload;

/**
 * What `POST /prompts/:id/render` answers with: the segment identity plus the rendered body.
 *
 * Stated here for the first time — the endpoint declared its response inline, so there has never
 * been a name for it on either side of the wire.
 */
export type RenderPromptResponse = Wire.RenderPromptResponse;

export type ExportedPromptTemplateRef = Wire.ExportedPromptTemplateRef;
