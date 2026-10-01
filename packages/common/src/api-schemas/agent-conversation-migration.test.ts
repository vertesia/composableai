import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from '../api-contract/index.js';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE as apiVersion } from '../versions.js';
import {
    ImportAgentRunConversationArchivePayloadSchema,
    ImportAgentRunConversationArchiveResponseSchema,
} from './agent-conversation-migration.js';
import { ApiSchemaComponents } from './registry.js';

const source = {
    subject_run_id: 'run:child',
    owner_run_id: 'run:owner',
    scope: 'workstream:launch',
    workflow_id: 'workflow:child',
    first_workflow_run_id: 'temporal:first',
    content_hash: `sha256:${'a'.repeat(64)}`,
    byte_length: 20,
    storage_generation: 'etag',
    immutable_storage_version: null,
};
const attestation = {
    evidence: 'owner_attested',
    protocol: 'anthropic.messages',
    provider: 'vertexai',
    model: null,
    completeness: 'fragment',
    recorded_at: '2026-10-01T00:00:00.000Z',
    evidence_note: 'Declared archive origin',
    tool_definitions: [],
};

describe('explicit canonical archive import contract', () => {
    it.each([
        ['ImportAgentRunConversationArchivePayload', 'type'],
        ['ImportAgentRunConversationArchiveResponse', 'status'],
    ] as const)('publishes %s with its canonical discriminator', (component, tag) => {
        expect(ApiSchemaComponents[component]).toMatchObject({
            type: 'object',
            required: [tag],
            discriminator: { propertyName: tag },
        });
    });

    it('keeps unknown origin, conditional storage identity and readiness explicit', () => {
        const request = { type: 'attested_native', expected_source: source, attestation };
        expect(ImportAgentRunConversationArchivePayloadSchema.safeParse(request).success).toBe(true);
        expect(validateApiRequest('ImportAgentRunConversationArchivePayload', request).valid).toBe(true);
        const response = {
            status: 'attestation_required',
            api_version: apiVersion,
            source,
            continuation_readiness: 'not_validated',
        };
        expect(ImportAgentRunConversationArchiveResponseSchema.safeParse(response).success).toBe(true);
        expect(validateApiResponse('ImportAgentRunConversationArchiveResponse', response).valid).toBe(true);
    });

    it.each([
        { type: 'source', model: 'current-target' },
        { type: 'attested_native', expected_source: { ...source, byte_length: 16 * 1024 * 1024 + 1 }, attestation },
        { type: 'attested_native', expected_source: { ...source, scope: 'workstream:' }, attestation },
        {
            type: 'attested_native',
            expected_source: source,
            attestation: { ...attestation, evidence: 'provider_verified' },
        },
        {
            type: 'attested_native',
            expected_source: source,
            attestation: { ...attestation, tool_definitions: [{ name: 'tool' }] },
        },
    ])('rejects invalid request identically in Zod and published AJV: %j', (request) => {
        expect(ImportAgentRunConversationArchivePayloadSchema.safeParse(request).success).toBe(false);
        expect(validateApiRequest('ImportAgentRunConversationArchivePayload', request).valid).toBe(false);
    });

    it('requires the exact version and status-specific head', () => {
        for (const response of [
            { status: 'attestation_required', api_version: 'future', source, continuation_readiness: 'not_validated' },
            { status: 'initialized', api_version: apiVersion, source, continuation_readiness: 'ready' },
            { status: 'already_initialized', api_version: apiVersion, source, continuation_readiness: 'not_validated' },
        ]) {
            expect(ImportAgentRunConversationArchiveResponseSchema.safeParse(response).success).toBe(false);
            expect(validateApiResponse('ImportAgentRunConversationArchiveResponse', response).valid).toBe(false);
        }
    });
});
