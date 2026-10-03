import { createConversationDocument } from '@llumiverse/conversation';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalInitialAuthoringResponseSchema } from './canonical-initial-authoring.js';
import { ApiSchemaComponents } from './registry.js';
import {
    ExperimentalCanonicalInitialRenderedInputHeadPayloadSchema,
    ExperimentalCanonicalVersionedHeadPayloadSchema,
} from './run-conversation-append.js';

function rendered() {
    return {
        kind: 'initial_rendered_input',
        activity: {
            execution_run_id: 'actual:stored-run',
            request: {
                kind: 'initial_agent',
                operation_id: 'operation:actual',
                request: {
                    interaction: 'stored-interaction',
                    initial_state: {
                        type: 'document',
                        document: createConversationDocument({
                            id: 'source:actual',
                            created_at: '2026-10-03T00:00:00Z',
                        }),
                    },
                    retention: 'DEBUG',
                    return_policy: { history: 'none' },
                },
                agent_acceptance: {
                    version: 1,
                    subject_agent_run_id: 'subject:actual',
                    scope: 'root',
                    activity_id: 'activity:actual',
                },
                activity_delivery: { activity_id: 'activity:actual', run_id: 'run:actual', task_token: 'actual-token' },
            },
        },
    };
}
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}
describe('initial rendered-input host reference contract', () => {
    it('round-trips the original scheduled request and run reference, without a submitted rendered document', () => {
        const value = rendered();
        expect(ExperimentalCanonicalInitialRenderedInputHeadPayloadSchema.parse(value)).toEqual(value);
        expect(ExperimentalCanonicalVersionedHeadPayloadSchema.parse(value)).toEqual(value);
        expect(validator('ExperimentalCanonicalInitialRenderedInputHeadPayload')(value)).toBe(true);
        expect(validator('ExperimentalCanonicalVersionedHeadPayload')(value)).toBe(true);
    });
    it('rejects submitted head/count/target/segments and missing original membership evidence in Zod and AJV', () => {
        const value = rendered();
        for (const invalid of [
            { ...value, document: value.activity.request.request.initial_state.document },
            { ...value, target: {} },
            { ...value, activity: { ...value.activity, segments: [] } },
            { ...value, activity: { ...value.activity, source: { conversation_id: 'invented', revision: 999 } } },
            { ...value, activity: { request: value.activity.request } },
            {
                ...value,
                activity: { ...value.activity, request: { ...value.activity.request, activity_delivery: {} } },
            },
            { ...value, kind: 'ingestion_preparation' },
        ]) {
            expect(ExperimentalCanonicalInitialRenderedInputHeadPayloadSchema.safeParse(invalid).success).toBe(false);
            expect(validator('ExperimentalCanonicalInitialRenderedInputHeadPayload')(invalid)).toBe(false);
        }
    });
    it('keeps targetless authoring response distinct from accepted input and generation evidence', () => {
        const response = {
            execution_run_id: 'actual:stored-run',
            source: { conversation_id: 'source:actual', revision: 0 },
        };
        expect(ExperimentalCanonicalInitialAuthoringResponseSchema.parse(response)).toEqual(response);
        const validate = validator('ExperimentalCanonicalInitialAuthoringResponse');
        expect(validate(response)).toBe(true);
        for (const field of ['admission', 'target', 'accepted_input', 'accepted_output', 'segments']) {
            const invalid = { ...response, [field]: {} };
            expect(ExperimentalCanonicalInitialAuthoringResponseSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }
    });
});
