import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
    parseExperimentalAgentRunControlEvent,
    parseExperimentalAgentRunStreamEnvelope,
    parseExperimentalAgentRunUpdatesResponse,
} from '../canonical-stream-runtime/index.js';
import type {
    ExperimentalAgentRunControlEvent,
    ExperimentalAgentRunStreamEnvelope,
    ExperimentalAgentRunUpdatesResponse,
} from '../store/agent-run.js';
import {
    ExperimentalAgentRunControlEventSchema,
    ExperimentalAgentRunStreamEnvelopeSchema,
    ExperimentalAgentRunUpdatesResponseSchema,
} from './agent-runs.js';
import { ApiSchemaComponents } from './registry.js';

const control: ExperimentalAgentRunControlEvent = {
    version: 1,
    event: 'user_input_received',
    event_id: 'control:one',
    ack: 'client:one',
    editing_action: { operation_id: 'edit:one', resource: { kind: 'store_document', document_id: 'document:one' } },
    request_input_response: { request_id: 'input:one' },
};
const route = { api_version: '=20260930', agent_run_id: 'run:one', scope: 'root' } as const;
const notification = { ...route, type: 'run_control', timestamp: 1790812800000, control } as const;
const status = {
    ...route,
    type: 'run_status',
    status: 'running',
    activity_state: 'idle',
    updated_at: '2026-10-01T00:00:00.000Z',
} as const;
const updates: ExperimentalAgentRunUpdatesResponse = {
    run: status,
    source: { ...route, status: 'uninitialized' },
    controls: [notification],
    control_page: { after: notification.timestamp, has_more: false, gap_before: false },
};
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}

describe('canonical agent host contract', () => {
    it('exports the exact published inferred shapes and leaves content-only stream unchanged', () => {
        expectTypeOf<ExperimentalAgentRunControlEvent>().toEqualTypeOf<
            z.infer<typeof ExperimentalAgentRunControlEventSchema>
        >();
        expectTypeOf<ExperimentalAgentRunStreamEnvelope>().toEqualTypeOf<
            z.infer<typeof ExperimentalAgentRunStreamEnvelopeSchema>
        >();
        expectTypeOf<ExperimentalAgentRunUpdatesResponse>().toEqualTypeOf<
            z.infer<typeof ExperimentalAgentRunUpdatesResponseSchema>
        >();
        expect(ApiSchemaComponents.ExperimentalAgentEditingResource).toMatchObject({
            type: 'object',
            required: ['kind'],
            discriminator: { propertyName: 'kind' },
        });
        expect(ApiSchemaComponents.ExperimentalAgentDocumentEditingAction).toMatchObject({
            type: 'object',
            required: ['action'],
            discriminator: { propertyName: 'action' },
        });
        expect(validator('ExperimentalAgentConversationStreamEnvelope')(notification)).toBe(false);
        for (const value of [notification, status]) {
            expect(ExperimentalAgentRunStreamEnvelopeSchema.safeParse(value).success).toBe(true);
            expect(validator('ExperimentalAgentRunStreamEnvelope')(value)).toBe(true);
            expect(parseExperimentalAgentRunStreamEnvelope(JSON.parse(JSON.stringify(value)))).toEqual(value);
        }
        expect(parseExperimentalAgentRunUpdatesResponse(updates)).toEqual(updates);
    });
    it('preserves optional absence, content-free editing identifiers and exact receipt identity', () => {
        const minimal = { version: 1, event: 'user_input_received', event_id: 'control:minimal' };
        expect(parseExperimentalAgentRunControlEvent(minimal)).toEqual(minimal);
        expect(parseExperimentalAgentRunControlEvent(control)).toEqual(control);
        expect(validator('ExperimentalAgentRunUpdatesResponse')(updates)).toBe(true);
    });
    it.each([
        { ...control, version: 2 },
        { ...control, event: 'response_accepted' },
        { ...control, message: 'a second transcript' },
        { ...control, event_id: '' },
        { ...control, request_input_response: { request_id: 'input:one', auth_token: 'forbidden' } },
    ])('rejects invalid/authority-bearing controls equally through Zod, registry and browser parser', (value) => {
        expect(ExperimentalAgentRunControlEventSchema.safeParse(value).success).toBe(false);
        expect(validator('ExperimentalAgentRunControlEvent')(value)).toBe(false);
        expect(() => parseExperimentalAgentRunControlEvent(value)).toThrow();
    });
    it('rejects a duplicate or foreign control route in an otherwise valid poll snapshot', () => {
        expect(() =>
            parseExperimentalAgentRunUpdatesResponse({ ...updates, controls: [notification, notification] }),
        ).toThrow('repeat');
        expect(() =>
            parseExperimentalAgentRunUpdatesResponse({
                ...updates,
                controls: [{ ...notification, agent_run_id: 'foreign:run' }],
            }),
        ).toThrow('route');
        expect(() =>
            parseExperimentalAgentRunControlEvent({ ...control, editing_action: { loop: undefined } }),
        ).toThrow('preflight');
    });
});

it('compares semantic control identity despite delivery timestamp or JSON key order, while binding route/payload', async () => {
    const { experimentalAgentRunControlIdentity } = await import('../canonical-stream-runtime/index.js');
    const reordered = {
        ...notification,
        timestamp: notification.timestamp + 10,
        control: {
            request_input_response: control.request_input_response,
            editing_action: control.editing_action,
            ack: control.ack,
            event_id: control.event_id,
            event: control.event,
            version: control.version,
        },
    };
    expect(experimentalAgentRunControlIdentity(notification)).toBe(experimentalAgentRunControlIdentity(reordered));
    expect(experimentalAgentRunControlIdentity({ ...notification, control: { ...control, ack: 'changed' } })).not.toBe(
        experimentalAgentRunControlIdentity(notification),
    );
    expect(experimentalAgentRunControlIdentity({ ...notification, agent_run_id: 'foreign' })).not.toBe(
        experimentalAgentRunControlIdentity(notification),
    );
});

it('keeps full typed editing content only in accepted user metadata and rejects it in pure host ACKs', async () => {
    const { parseExperimentalAgentDocumentEditingAction, parseExperimentalAgentUserInputMetadata } = await import(
        '../canonical-stream-runtime/index.js'
    );
    const action = {
        operation_id: 'edit:one',
        resource: { kind: 'store_document', document_id: 'document:one', name: 'Plan' },
        action: 'edit',
        anchor: { block_id: 'paragraph:one', block_type: 'paragraph', exact_text: 'Original.' },
        user_change: { before: 'Original.', after: 'Actual edited text.' },
        comment: 'Actual comment.',
    };
    const metadata = {
        client_message_id: 'client:one',
        display_message: 'Local edit',
        editing_action: action,
        request_input_response: { request_id: 'request:one' },
    };
    expect(validator('ExperimentalAgentDocumentEditingAction')(action)).toBe(true);
    expect(validator('ExperimentalAgentUserInputMetadata')(metadata)).toBe(true);
    expect(parseExperimentalAgentDocumentEditingAction(JSON.parse(JSON.stringify(action)))).toEqual(action);
    expect(parseExperimentalAgentUserInputMetadata(JSON.parse(JSON.stringify(metadata)))).toEqual(metadata);
    for (const value of [
        { ...control, editing_action: action },
        { ...control, editing_action: { ...control.editing_action, user_change: action.user_change } },
        { ...control, editing_action: { operation_id: 'edit:one', resource: action.resource } },
        { ...control, event_id: 'x'.repeat(513) },
    ]) {
        expect(ExperimentalAgentRunControlEventSchema.safeParse(value).success).toBe(false);
        expect(validator('ExperimentalAgentRunControlEvent')(value)).toBe(false);
        expect(() => parseExperimentalAgentRunControlEvent(value)).toThrow();
    }
    expect(() =>
        parseExperimentalAgentUserInputMetadata({ ...metadata, private_source_proof: { token: 'hidden' } }),
    ).toThrow();
});

it('pins cursor to exact ordered controls and rejects forged paging/unknown query fields', () => {
    expect(() =>
        parseExperimentalAgentRunUpdatesResponse({
            ...updates,
            control_page: { ...updates.control_page, after: notification.timestamp - 1 },
        }),
    ).toThrow('cursor');
    const second = {
        ...notification,
        timestamp: notification.timestamp - 1,
        control: { ...control, event_id: 'second' },
    };
    expect(() => parseExperimentalAgentRunUpdatesResponse({ ...updates, controls: [notification, second] })).toThrow(
        'order',
    );
    expect(
        validator('ExperimentalAgentRunStreamQuery')({
            conversation_scope: 'root',
            control_after: 1,
            control_limit: 100,
        }),
    ).toBe(true);
    expect(validator('ExperimentalAgentConversationStreamQuery')({ control_after: 1 })).toBe(false);
    for (const value of [
        { control_limit: 101 },
        { control_after: -1 },
        { control_after: Number.MAX_SAFE_INTEGER + 1 },
        { private_ledger: true },
    ])
        expect(validator('ExperimentalAgentRunStreamQuery')(value)).toBe(false);
});

// The shipping Java/Go recipes copy this exact standalone SDK fixture into their test resources.
const shippingHostFixture: unknown = JSON.parse(
    readFileSync(new URL('../../test-fixtures/canonical-agent-host-envelopes.json', import.meta.url), 'utf8'),
);
const hostFixture = z
    .strictObject({
        streams: z.record(z.string(), z.unknown()),
        updates: z.record(z.string(), z.unknown()),
        invalid: z.array(
            z.strictObject({
                name: z.string(),
                component: z.enum(['ExperimentalAgentRunStreamEnvelope', 'ExperimentalAgentRunUpdatesResponse']),
                value: z.unknown(),
            }),
        ),
    })
    .parse(shippingHostFixture);

it('pins shipping host stream and poll fixtures through Zod, emitted AJV and browser parsers', () => {
    expect(Object.keys(hostFixture.streams).sort()).toEqual([
        'accepted',
        'editing_control',
        'event',
        'minimal_control',
        'preview',
        'status',
    ]);
    for (const value of Object.values(hostFixture.streams)) {
        expect(ExperimentalAgentRunStreamEnvelopeSchema.parse(value)).toEqual(value);
        expect(validator('ExperimentalAgentRunStreamEnvelope')(value)).toBe(true);
        expect(parseExperimentalAgentRunStreamEnvelope(value)).toEqual(value);
    }
    for (const value of Object.values(hostFixture.updates)) {
        expect(ExperimentalAgentRunUpdatesResponseSchema.parse(value)).toEqual(value);
        expect(validator('ExperimentalAgentRunUpdatesResponse')(value)).toBe(true);
        expect(parseExperimentalAgentRunUpdatesResponse(value)).toEqual(value);
    }
});

it.each(hostFixture.invalid)('rejects shipping host fixture $name with the declared component', (row) => {
    const stream = row.component === 'ExperimentalAgentRunStreamEnvelope';
    const schema = stream ? ExperimentalAgentRunStreamEnvelopeSchema : ExperimentalAgentRunUpdatesResponseSchema;
    expect(schema.safeParse(row.value).success).toBe(false);
    expect(validator(row.component)(row.value)).toBe(false);
    expect(() =>
        stream
            ? parseExperimentalAgentRunStreamEnvelope(row.value)
            : parseExperimentalAgentRunUpdatesResponse(row.value),
    ).toThrow();
});

it('publishes host delivery timestamp and cursors as int64 without changing safe JSON integer bounds', () => {
    expect(ApiSchemaComponents.ExperimentalAgentRunControlNotification).toMatchObject({
        properties: { timestamp: { type: 'integer', format: 'int64', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } },
    });
    expect(ApiSchemaComponents.ExperimentalAgentControlPage).toMatchObject({
        properties: { after: { type: 'integer', format: 'int64', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } },
    });
    expect(ApiSchemaComponents.ExperimentalAgentRunStreamQuery).toEqual({
        $ref: '#/components/schemas/ExperimentalAgentRunUpdatesQuery',
    });
    expect(ApiSchemaComponents.ExperimentalAgentRunUpdatesQuery).toMatchObject({
        properties: {
            control_after: { type: 'integer', format: 'int64', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        },
    });
});
