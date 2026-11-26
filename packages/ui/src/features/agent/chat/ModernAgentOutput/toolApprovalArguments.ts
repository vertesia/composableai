import type { AgentMessage } from '@vertesia/common';
import { TOOL_APPROVAL_REDACTED_PLACEHOLDER } from './requestInputMessages';

/**
 * A readable summary of the arguments of a tool call waiting for approval, built from the redacted arguments the
 * prompt carries (`details.tool_approval.input`). Generic: it knows nothing about any tool, only the shapes of
 * JSON values. Pure, so the card only renders what this returns.
 */

/** A short preview of a value nested in a list or an object. */
export type ToolArgumentPreview =
    | { kind: 'text'; text: string }
    | { kind: 'redacted' }
    | { kind: 'empty' }
    | { kind: 'list'; count: number }
    | { kind: 'object'; count: number };

export interface ToolArgumentField {
    key: string;
    label: string;
    preview: ToolArgumentPreview;
}

export interface ToolArgumentSchemaProperty {
    name: string;
    /** `string`, `number | null`, `array of string`, or undefined when the schema does not say. */
    type?: string;
    enumValues?: string[];
    required: boolean;
}

export type ToolArgumentValue =
    | { kind: 'text'; text: string; long: boolean }
    | { kind: 'redacted' }
    | { kind: 'empty' }
    | { kind: 'list'; count: number; items: ToolArgumentPreview[] }
    | { kind: 'object'; count: number; fields: ToolArgumentField[] }
    | { kind: 'schema'; properties: ToolArgumentSchemaProperty[]; moreProperties: number };

export interface ToolArgumentRow {
    key: string;
    label: string;
    value: ToolArgumentValue;
}

export interface ToolArgumentSummary {
    /** Every argument, the most informative first. */
    rows: ToolArgumentRow[];
    /** How many rows to show before the reader asks for the rest. */
    visibleCount: number;
}

/** Rows shown before "Show all arguments". */
export const TOOL_ARGUMENT_VISIBLE_ROWS = 4;
/** Items of a list previewed in its row. */
export const TOOL_ARGUMENT_LIST_PREVIEW_ITEMS = 3;
/** Fields of a nested object previewed in its row. */
export const TOOL_ARGUMENT_OBJECT_PREVIEW_FIELDS = 6;
/** Properties of a JSON Schema argument listed in its row. */
export const TOOL_ARGUMENT_SCHEMA_PROPERTIES = 20;
/** A text longer than this, or with more lines, is clamped until the reader expands it. */
export const TOOL_ARGUMENT_LONG_TEXT_LENGTH = 160;
const LONG_TEXT_LINES = 3;
/** Longest preview of a value nested in a list or an object. */
const PREVIEW_TEXT_LENGTH = 80;

/** Names that usually say which thing a call acts on: shown before the other arguments. */
const IDENTIFYING_KEY = /(^|_)(id|ids|name|names|title|type|path|url|uri|key|target|query)$/i;

const ACRONYMS = new Set(['id', 'ids', 'url', 'uri', 'api', 'json', 'sql', 'html', 'pdf', 'csv', 'llm', 'ui']);

/** The redacted arguments a tool approval prompt carries, or undefined for any other message. */
export function getToolApprovalArguments(message: AgentMessage): unknown {
    const details = asRecord(message.details);
    const toolApproval = asRecord(details?.tool_approval);
    return toolApproval?.input;
}

/** Summarize a call's arguments. An empty or missing input gives no rows. */
export function summarizeToolArguments(input: unknown): ToolArgumentSummary {
    const ranked = toRows(decodeJsonText(input))
        .map((row, index) => ({ row, index, rank: rankRow(row) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ row }) => row);
    // Hiding a single row behind a toggle saves nothing: show them all.
    const visibleCount = ranked.length <= TOOL_ARGUMENT_VISIBLE_ROWS + 1 ? ranked.length : TOOL_ARGUMENT_VISIBLE_ROWS;
    return { rows: ranked, visibleCount };
}

/** `content_source_id` → `Content source ID`, `maxItems` → `Max items`. */
export function humanizeArgumentName(name: string): string {
    const words = name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => {
            const lower = word.toLowerCase();
            return ACRONYMS.has(lower) ? lower.toUpperCase() : lower;
        });
    if (words.length === 0) return name;
    const [first, ...rest] = words;
    return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

function toRows(input: unknown): ToolArgumentRow[] {
    if (input === undefined || input === null) return [];
    const record = asRecord(input);
    if (!record) {
        return [{ key: 'input', label: humanizeArgumentName('input'), value: summarizeValue(input) }];
    }
    return Object.entries(record).map(([key, value]) => ({
        key,
        label: humanizeArgumentName(key),
        value: summarizeValue(decodeJsonText(value)),
    }));
}

function summarizeValue(value: unknown): ToolArgumentValue {
    if (value === TOOL_APPROVAL_REDACTED_PLACEHOLDER) return { kind: 'redacted' };
    if (value === undefined || value === null) return { kind: 'empty' };
    if (typeof value === 'string') {
        if (!value.trim()) return { kind: 'empty' };
        return { kind: 'text', text: value, long: isLongText(value) };
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return { kind: 'text', text: String(value), long: false };
    }
    if (Array.isArray(value)) {
        return {
            kind: 'list',
            count: value.length,
            items: value.slice(0, TOOL_ARGUMENT_LIST_PREVIEW_ITEMS).map(previewValue),
        };
    }
    const record = asRecord(value);
    if (!record) return { kind: 'text', text: String(value), long: false };
    const schema = summarizeSchema(record);
    if (schema) return schema;
    const entries = Object.entries(record);
    if (entries.length === 0) return { kind: 'empty' };
    return {
        kind: 'object',
        count: entries.length,
        fields: entries.slice(0, TOOL_ARGUMENT_OBJECT_PREVIEW_FIELDS).map(([key, child]) => ({
            key,
            label: humanizeArgumentName(key),
            preview: previewValue(child),
        })),
    };
}

function previewValue(value: unknown): ToolArgumentPreview {
    if (value === TOOL_APPROVAL_REDACTED_PLACEHOLDER) return { kind: 'redacted' };
    if (value === undefined || value === null) return { kind: 'empty' };
    if (typeof value === 'string') {
        const text = value.replace(/\s+/g, ' ').trim();
        if (!text) return { kind: 'empty' };
        return {
            kind: 'text',
            text: text.length > PREVIEW_TEXT_LENGTH ? `${text.slice(0, PREVIEW_TEXT_LENGTH)}…` : text,
        };
    }
    if (Array.isArray(value)) return { kind: 'list', count: value.length };
    const record = asRecord(value);
    if (record) {
        const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : undefined;
        // An object that names itself reads best by its name (`{ name: 'Invoice', … }` in a list of types).
        return name ? { kind: 'text', text: name } : { kind: 'object', count: Object.keys(record).length };
    }
    return { kind: 'text', text: String(value) };
}

/** A JSON Schema of an object (`type: 'object'` with `properties`), listed as its properties. */
function summarizeSchema(record: Record<string, unknown>): ToolArgumentValue | undefined {
    if (!schemaTypeIncludes(record.type, 'object')) return undefined;
    const properties = asRecord(record.properties);
    if (!properties) return undefined;
    const required = new Set(
        Array.isArray(record.required) ? record.required.filter((name) => typeof name === 'string') : [],
    );
    const entries = Object.entries(properties);
    return {
        kind: 'schema',
        properties: entries.slice(0, TOOL_ARGUMENT_SCHEMA_PROPERTIES).map(([name, definition]) => {
            const property = asRecord(definition);
            const enumValues = Array.isArray(property?.enum)
                ? property.enum.map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
                : undefined;
            return {
                name,
                type: property ? describeSchemaType(property) : undefined,
                ...(enumValues && enumValues.length > 0 ? { enumValues } : {}),
                required: required.has(name),
            };
        }),
        moreProperties: Math.max(0, entries.length - TOOL_ARGUMENT_SCHEMA_PROPERTIES),
    };
}

function describeSchemaType(property: Record<string, unknown>): string | undefined {
    const type = property.type;
    const types = Array.isArray(type)
        ? type.filter((name): name is string => typeof name === 'string')
        : typeof type === 'string'
          ? [type]
          : [];
    if (types.length === 0) {
        if (typeof property.$ref === 'string') return property.$ref.split('/').pop();
        return Array.isArray(property.enum) ? 'enum' : undefined;
    }
    return types
        .map((name) => {
            if (name !== 'array') return name;
            const items = asRecord(property.items);
            const itemType = items ? describeSchemaType(items) : undefined;
            return itemType ? `array of ${itemType}` : 'array';
        })
        .join(' | ');
}

function schemaTypeIncludes(type: unknown, name: string): boolean {
    return type === name || (Array.isArray(type) && type.includes(name));
}

/**
 * A model often sends an object argument as JSON text. Read such text as the value it holds, so it gets the same
 * summary as the object. The workflow already redacted the secrets inside it.
 */
function decodeJsonText(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    if (!((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) return value;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return value;
    }
}

function isLongText(text: string): boolean {
    return text.length > TOOL_ARGUMENT_LONG_TEXT_LENGTH || text.split('\n').length > LONG_TEXT_LINES;
}

function rankRow(row: ToolArgumentRow): number {
    const { value } = row;
    if (value.kind === 'empty') return 4;
    if (value.kind === 'list' || value.kind === 'object' || value.kind === 'schema') return 2;
    if (value.kind === 'text' && value.long) return 1;
    return IDENTIFYING_KEY.test(row.key) ? 0 : 1;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
