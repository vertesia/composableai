import { AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { TOOL_APPROVAL_REDACTED_PLACEHOLDER } from './requestInputMessages';
import {
    getToolApprovalArguments,
    humanizeArgumentName,
    summarizeToolArguments,
    TOOL_ARGUMENT_VISIBLE_ROWS,
} from './toolApprovalArguments';

describe('summarizeToolArguments', () => {
    it('gives no rows for an empty or missing input', () => {
        expect(summarizeToolArguments(undefined)).toEqual({ rows: [], visibleCount: 0 });
        expect(summarizeToolArguments(null)).toEqual({ rows: [], visibleCount: 0 });
        expect(summarizeToolArguments({})).toEqual({ rows: [], visibleCount: 0 });
    });

    it('renders top-level scalars as labelled rows, identifying arguments first', () => {
        const { rows, visibleCount } = summarizeToolArguments({
            sample_percent: 10,
            enabled: true,
            content_source_id: 'cs-1',
        });

        expect(rows).toEqual([
            {
                key: 'content_source_id',
                label: 'Content source ID',
                value: { kind: 'text', text: 'cs-1', long: false },
            },
            { key: 'sample_percent', label: 'Sample percent', value: { kind: 'text', text: '10', long: false } },
            { key: 'enabled', label: 'Enabled', value: { kind: 'text', text: 'true', long: false } },
        ]);
        expect(visibleCount).toBe(3);
    });

    it('flags long and multi-line strings so the card clamps them', () => {
        const long = 'x'.repeat(200);
        const { rows } = summarizeToolArguments({ description: long, notes: 'a\nb\nc\nd', name: 'short' });

        expect(rows.map((row) => [row.key, row.value])).toEqual([
            ['name', { kind: 'text', text: 'short', long: false }],
            ['description', { kind: 'text', text: long, long: true }],
            ['notes', { kind: 'text', text: 'a\nb\nc\nd', long: true }],
        ]);
    });

    it('summarizes arrays as a count and the first few items', () => {
        const { rows } = summarizeToolArguments({
            document_ids: ['a', 'b', 'c', 'd', 'e'],
            types: [{ name: 'Invoice', schema: {} }, { other: 1 }, [1, 2], null],
        });

        expect(rows[0].value).toEqual({
            kind: 'list',
            count: 5,
            items: [
                { kind: 'text', text: 'a' },
                { kind: 'text', text: 'b' },
                { kind: 'text', text: 'c' },
            ],
        });
        expect(rows[1].value).toEqual({
            kind: 'list',
            count: 4,
            items: [
                { kind: 'text', text: 'Invoice' },
                { kind: 'object', count: 1 },
                { kind: 'list', count: 2 },
            ],
        });
    });

    it('collapses a nested object one level', () => {
        const { rows } = summarizeToolArguments({
            options: { strict: true, nested: { deep: { deeper: 1 } }, list: [1], note: '' },
        });

        expect(rows[0].value).toEqual({
            kind: 'object',
            count: 4,
            fields: [
                { key: 'strict', label: 'Strict', preview: { kind: 'text', text: 'true' } },
                { key: 'nested', label: 'Nested', preview: { kind: 'object', count: 1 } },
                { key: 'list', label: 'List', preview: { kind: 'list', count: 1 } },
                { key: 'note', label: 'Note', preview: { kind: 'empty' } },
            ],
        });
    });

    it('lists a JSON Schema argument as its properties, with types and enum values', () => {
        const { rows } = summarizeToolArguments({
            object_schema: {
                type: 'object',
                required: ['title'],
                properties: {
                    title: { type: 'string' },
                    status: { type: 'string', enum: ['draft', 'final'] },
                    amount: { type: ['number', 'null'] },
                    tags: { type: 'array', items: { type: 'string' } },
                    owner: { $ref: '#/definitions/Person' },
                },
            },
        });

        expect(rows[0].value).toEqual({
            kind: 'schema',
            moreProperties: 0,
            properties: [
                { name: 'title', type: 'string', required: true },
                { name: 'status', type: 'string', enumValues: ['draft', 'final'], required: false },
                { name: 'amount', type: 'number | null', required: false },
                { name: 'tags', type: 'array of string', required: false },
                { name: 'owner', type: 'Person', required: false },
            ],
        });
    });

    it('reads JSON text the way it reads the object it holds', () => {
        const { rows } = summarizeToolArguments({
            object_schema: JSON.stringify({ type: 'object', properties: { title: { type: 'string' } } }),
        });

        expect(rows[0].value.kind).toBe('schema');
    });

    it('keeps redacted values redacted, at the top level and nested', () => {
        const { rows } = summarizeToolArguments({
            api_key: TOOL_APPROVAL_REDACTED_PLACEHOLDER,
            headers: { authorization: TOOL_APPROVAL_REDACTED_PLACEHOLDER },
            tokens: [TOOL_APPROVAL_REDACTED_PLACEHOLDER],
        });

        expect(rows.map((row) => row.value)).toEqual([
            { kind: 'redacted' },
            {
                kind: 'object',
                count: 1,
                fields: [{ key: 'authorization', label: 'Authorization', preview: { kind: 'redacted' } }],
            },
            { kind: 'list', count: 1, items: [{ kind: 'redacted' }] },
        ]);
        expect(JSON.stringify(rows)).not.toContain(TOOL_APPROVAL_REDACTED_PLACEHOLDER);
    });

    it('shows a few rows by default and the rest on demand, empty values last', () => {
        const input = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field_${index}`, `v${index}`]));
        const { rows, visibleCount } = summarizeToolArguments({ blank: null, ...input });

        expect(visibleCount).toBe(TOOL_ARGUMENT_VISIBLE_ROWS);
        expect(rows).toHaveLength(9);
        expect(rows[rows.length - 1].key).toBe('blank');
    });

    it('shows a non-object input as a single row', () => {
        expect(summarizeToolArguments('run it').rows).toEqual([
            { key: 'input', label: 'Input', value: { kind: 'text', text: 'run it', long: false } },
        ]);
    });
});

describe('humanizeArgumentName', () => {
    it('turns snake, kebab and camel case into a sentence-case label', () => {
        expect(humanizeArgumentName('content_source_id')).toBe('Content source ID');
        expect(humanizeArgumentName('siteUrl')).toBe('Site URL');
        expect(humanizeArgumentName('max-items')).toBe('Max items');
    });
});

describe('getToolApprovalArguments', () => {
    it('reads the redacted arguments of a tool approval prompt only', () => {
        const input = { name: 'X' };
        expect(
            getToolApprovalArguments({
                type: AgentMessageType.REQUEST_INPUT,
                timestamp: 1,
                workflow_run_id: 'run',
                message: 'Approve?',
                details: { tool_approval: { tool_name: 't', approval_key: 't:x', input } },
            }),
        ).toBe(input);
        expect(
            getToolApprovalArguments({
                type: AgentMessageType.REQUEST_INPUT,
                timestamp: 1,
                workflow_run_id: 'run',
                message: 'Question?',
                details: {},
            }),
        ).toBeUndefined();
    });
});
