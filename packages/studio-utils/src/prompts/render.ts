import type { JSONObject, JSONSchema, PromptSegment } from '@llumiverse/common';
import { type PromptSegmentDef, PromptSegmentDefType, type PromptTemplate, TemplateType } from '@vertesia/common';
import {
    CompositeError,
    renderHandlebarsTemplate,
    renderJsTemplate,
    type TemplateSystemContext,
    withTemplateSystemVariables,
} from '@vertesia/jst';

export interface SegmentPreview {
    error?: Error;
    title: string;
    content: string;
    segmentId?: string;
}

/**
 * Render a prompt template with the given input data.
 *
 * Handlebars templates use {{variable}} interpolation against `data`. JST (JavaScript template)
 * bodies evaluate against `data` with the schema's top-level property names exposed as globals.
 * Both see the system variables (`TEMPLATE_SYSTEM_VARIABLES` in `@vertesia/jst`), added here the
 * same way the studio-server executor adds them, so a preview renders what an execution would.
 * `_model` is only set when the caller passes `system.model` or the data already carries it.
 *
 * For `TemplateType.text`, the content is returned verbatim — it is static text, not a
 * template — matching the studio-server executor (see `apps/studio-server/src/executor/
 * rendering/template.ts`). Routing it through the JST evaluator would compile the prose as
 * JavaScript and throw on any plain sentence (e.g. "You are a helpful assistant.").
 */
export function renderTemplate(
    code: string,
    contentType: TemplateType,
    schema: JSONSchema,
    data: JSONObject,
    system?: TemplateSystemContext,
): string {
    if (contentType === TemplateType.text) {
        return code;
    }
    const input = withTemplateSystemVariables(data, system);
    if (contentType === TemplateType.handlebars) {
        return renderHandlebarsTemplate(code, input);
    }
    return renderJsTemplate(code, schema.properties ? Object.keys(schema.properties) : [], input);
}

/**
 * Execute a JST (JavaScript Template) with given data.
 * Returns a discriminated union to surface errors without throwing.
 */
export function executeJST(
    jstContent: string,
    schema: JSONSchema,
    data: JSONObject,
): { success: true; content: string } | { success: false; error: string } {
    try {
        const result = renderTemplate(jstContent, TemplateType.jst, schema, data);
        return { success: true, content: result };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Execute a Handlebars template with given data.
 * Returns a discriminated union to surface errors without throwing.
 */
export function executeHandlebars(
    handlebarsContent: string,
    schema: JSONSchema,
    data: JSONObject,
): { success: true; content: string } | { success: false; error: string } {
    try {
        const result = renderTemplate(handlebarsContent, TemplateType.handlebars, schema, data);
        return { success: true, content: result };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

function renderChatSegment(segment: PromptSegmentDef<PromptTemplate>, data: JSONObject) {
    const chatKey = getChatKey(segment.configuration);
    const chat = data[chatKey];
    let content: string;
    if (Array.isArray(chat)) {
        content = JSON.stringify(chat, undefined, 2);
    } else {
        content = `No "${chatKey}" property found on input data`;
    }
    return {
        title: 'Chat history',
        content,
    };
}

function renderTemplateSegment(segment: PromptSegmentDef<PromptTemplate>, data: JSONObject) {
    if (!segment.template) {
        return { title: '(unknown segment)', content: '', error: new Error('Prompt segment is missing its template') };
    }
    const schema = segment.template.inputSchema || {};
    const title = `@${segment.template.role}`;
    try {
        const content = renderTemplate(segment.template.content, segment.template.content_type, schema, data);
        return { title, content, segmentId: segment.template.id };
    } catch (error) {
        // Isolate the failure to this segment so the remaining segments still render.
        return {
            title,
            content: error instanceof Error ? error.message : String(error),
            segmentId: segment.template.id,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

export function renderSegments(segments: PromptSegmentDef<PromptTemplate>[], data: JSONObject): SegmentPreview[] {
    const out: SegmentPreview[] = [];
    for (const segment of segments) {
        if (segment.type === PromptSegmentDefType.chat) {
            out.push(renderChatSegment(segment, data));
        } else if (segment.type === PromptSegmentDefType.template) {
            out.push(renderTemplateSegment(segment, data));
        }
    }
    return out;
}

export function renderSegmentsOrErrors(
    segments: PromptSegmentDef<PromptTemplate>[],
    textOrObject: string | JSONObject,
): SegmentPreview[] {
    try {
        return renderSegments(
            segments,
            typeof textOrObject === 'string' ? JSON.parse(textOrObject.trim()) : textOrObject || {},
        );
    } catch (error: unknown) {
        if (error instanceof CompositeError) {
            return error.errors.map((err) => ({
                error: err as Error,
                title: 'Rendering Error',
                content: err.message,
            }));
        }
        return [
            {
                error: error instanceof Error ? error : new Error(String(error)),
                title: 'Rendering Error',
                content: error instanceof Error ? error.message : String(error),
            },
        ];
    }
}

export function renderPrompt(segments: PromptSegmentDef<PromptTemplate>[], payload: JSONObject): PromptSegment[] {
    const out: PromptSegment[] = [];
    for (const segment of segments) {
        if (segment.template) {
            const schema = segment.template.inputSchema || {};
            const content = renderTemplate(segment.template.content, segment.template.content_type, schema, payload);
            out.push({ role: segment.template.role, content });
        } else if (segment.type === PromptSegmentDefType.chat) {
            const chatKey = getChatKey(segment.configuration);
            const messages = payload[chatKey];
            if (!isPromptSegmentArray(messages)) {
                throw new Error('Chat prompt segment must have a messages array');
            }
            for (const msg of messages) {
                if (!msg.role) {
                    throw new Error('Chat prompt segment must have a role');
                }
                out.push({ role: msg.role, content: msg.content });
            }
        } else {
            throw new Error(`Unknown prompt segment type: ${segment.type}`);
        }
    }
    return out;
}

function getChatKey(configuration: unknown): string {
    if (
        typeof configuration === 'object' &&
        configuration !== null &&
        'chatKey' in configuration &&
        typeof (configuration as { chatKey: unknown }).chatKey === 'string'
    ) {
        return (configuration as { chatKey: string }).chatKey;
    }
    return 'chat';
}

function isPromptSegmentArray(value: unknown): value is PromptSegment[] {
    return Array.isArray(value) && value.every(isPromptSegment);
}

function isPromptSegment(value: unknown): value is PromptSegment {
    return typeof value === 'object' && value !== null && 'role' in value && 'content' in value;
}
