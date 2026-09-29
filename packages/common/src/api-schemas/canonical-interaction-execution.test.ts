import { describe, expect, it } from 'vitest';
import {
    ExperimentalCanonicalInteractionExecutionRequestSchema,
    ExperimentalCanonicalInteractionHeadersSchema,
    ExperimentalCanonicalInteractionHistorySchema,
} from './canonical-interaction-execution.js';

describe('experimental canonical interaction execution schemas', () => {
    it('requires the exact opt-in API version header', () => {
        expect(
            ExperimentalCanonicalInteractionHeadersSchema.parse({
                'x-api-version': '=20260930',
            }),
        ).toEqual({ 'x-api-version': '=20260930' });
        expect(ExperimentalCanonicalInteractionHeadersSchema.safeParse({ 'x-api-version': '20260930' }).success).toBe(
            false,
        );
        expect(ExperimentalCanonicalInteractionHeadersSchema.safeParse({ 'x-api-version': '=20260803' }).success).toBe(
            false,
        );
    });

    it('keeps retention and transient history return policy explicit and independent', () => {
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.parse({
                initial_state: { type: 'new' },
                retention: 'RESTRICTED',
                return_policy: { history: 'document' },
            }),
        ).toEqual({
            initial_state: { type: 'new' },
            retention: 'RESTRICTED',
            return_policy: { history: 'document' },
        });
    });

    it('rejects legacy run_data and unknown request fields instead of silently changing retention', () => {
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: { type: 'new' },
                retention: 'STANDARD',
                return_policy: { history: 'none' },
                config: { run_data: 'DEBUG' },
            }).success,
        ).toBe(false);
        expect(
            ExperimentalCanonicalInteractionExecutionRequestSchema.safeParse({
                initial_state: { type: 'new' },
                retention: 'STANDARD',
                return_policy: { history: 'none' },
                conversation: true,
            }).success,
        ).toBe(false);
    });

    it('requires unavailable history to name the reason rather than fabricating a reference', () => {
        expect(
            ExperimentalCanonicalInteractionHistorySchema.safeParse({
                status: 'unavailable',
                reason: 'retention_policy',
                retention: 'STANDARD',
            }).success,
        ).toBe(true);
        expect(
            ExperimentalCanonicalInteractionHistorySchema.safeParse({
                status: 'reference',
                conversation: { conversation_id: 'conversation-1' },
            }).success,
        ).toBe(false);
    });
});
