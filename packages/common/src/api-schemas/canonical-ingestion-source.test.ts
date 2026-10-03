import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalIngestionSourceBindingSchema } from './agent-routing-control.js';
import { ApiSchemaComponents } from './registry.js';

const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
addFormats.default(ajv);
const validate = ajv.compile({
    components: { schemas: ApiSchemaComponents },
    $ref: '#/components/schemas/ExperimentalCanonicalIngestionSourceBinding',
});
const ref = { conversation_id: 'conversation:accepted', revision: 2 };
const receipt = {
    id: 'input:user',
    conversation_id: ref.conversation_id,
    base_revision: 1,
    result_revision: 2,
    recorded_at: '2026-10-03T00:00:00Z',
    payload_fingerprint: 'sha256:input',
    accepted_turn_ids: ['input'],
    accepted_execution_receipt_ids: ['application:receipt'],
};
const value = {
    version: 1,
    accepted_source: ref,
    effective_source: { ...ref, revision: 7 },
    accepted_anchor: { kind: 'accepted_input', receipt },
    document_fingerprint: 'sha256:document',
    processing_fingerprint: 'sha256:processing',
};

describe('published server-authored ingestion lineage data', () => {
    it('preserves complete input receipts and distinct retained output anchors in Zod and AJV', () => {
        const {
            payload_fingerprint: _fingerprint,
            accepted_execution_receipt_ids: _executions,
            ...outputReceipt
        } = receipt;
        const output = {
            ...value,
            accepted_anchor: {
                kind: 'retained_output',
                receipt: {
                    ...outputReceipt,
                    accepted_turn_ids: ['answer'],
                    accepted_generation_ids: ['generation'],
                },
            },
        };
        for (const valid of [value, output]) {
            expect(ExperimentalCanonicalIngestionSourceBindingSchema.parse(valid)).toEqual(valid);
            expect(validate(valid)).toBe(true);
        }
    });
    it.each(['target', 'model', 'current_execution', 'ready', 'generation_admission', 'document'])(
        'rejects added %s authority/content fields',
        (field) => {
            const invalid = { ...value, [field]: {} };
            expect(ExperimentalCanonicalIngestionSourceBindingSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        },
    );
    it.each([
        'accepted_source',
        'accepted_anchor',
        'effective_source',
        'document_fingerprint',
        'processing_fingerprint',
    ])('requires %s rather than permitting a partial source claim', (field) => {
        const invalid: Record<string, unknown> = { ...value };
        delete invalid[field];
        expect(ExperimentalCanonicalIngestionSourceBindingSchema.safeParse(invalid).success).toBe(false);
        expect(validate(invalid)).toBe(false);
    });
    it('does not accept unknown anchor kinds, null evidence or a negative revision', () => {
        for (const invalid of [
            { ...value, accepted_anchor: { kind: 'caller_source', receipt } },
            { ...value, accepted_anchor: null },
            { ...value, effective_source: { ...ref, revision: -1 } },
            { ...value, document_fingerprint: null },
            { ...value, accepted_anchor: { ...value.accepted_anchor, ready: true } },
        ]) {
            expect(ExperimentalCanonicalIngestionSourceBindingSchema.safeParse(invalid).success).toBe(false);
            expect(validate(invalid)).toBe(false);
        }
    });
});
