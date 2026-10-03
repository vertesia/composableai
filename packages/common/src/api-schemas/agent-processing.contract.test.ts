import { createConversationDocument } from '@llumiverse/conversation';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, test } from 'vitest';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE } from '../versions.js';
import {
    ExperimentalAgentProcessingActivityEvidenceSchema,
    ExperimentalAgentProcessingClaimSchema,
    ExperimentalClaimAgentProcessingPayloadSchema,
} from './agent-processing.js';
import { ApiSchemaComponents } from './registry.js';
import {
    ExperimentalAgentProcessingHeadPayloadSchema,
    ExperimentalCanonicalVersionedHeadPayloadSchema,
    PublishAgentRunConversationHeadPayloadSchema,
} from './run-conversation-append.js';

const document = createConversationDocument({ id: 'conversation:processing-head', created_at: '2026-10-03T00:00:00Z' });
const authority = {
    version: 1,
    kind: 'native_processing_activity',
    subject_agent_run_id: 'subject:one',
    owner_agent_run_id: 'subject:one',
    scope: 'root',
    source: { conversation_id: document.id, revision: document.revision },
    job_id: 'job:one',
    workflow_run_id: 'workflow-run:one',
    activity_id: 'activity:one',
    task_token: 'opaque-token',
} as const;
const head = {
    kind: 'processing_job_head',
    expected_head: { conversation_id: document.id, revision: document.revision },
    document,
    processing_authority: authority,
} as const;

function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}

describe('versioned processing head wire', () => {
    test('published Zod and AJV accept the exact processing branch and retained ordinary body', () => {
        expect(ExperimentalAgentProcessingActivityEvidenceSchema.parse(authority)).toEqual(authority);
        expect(ExperimentalClaimAgentProcessingPayloadSchema.parse(authority)).toEqual(authority);
        const claim = {
            api_version: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
            subject_agent_run_id: authority.subject_agent_run_id,
            owner_agent_run_id: authority.owner_agent_run_id,
            scope: authority.scope,
            source: authority.source,
            job_id: authority.job_id,
            job_fingerprint: `sha256:${'a'.repeat(64)}`,
            workflow_id: 'workflow:one',
            workflow_run_id: authority.workflow_run_id,
            activity_id: authority.activity_id,
            attempt: 1,
            processing_attempt_id: `native:${'b'.repeat(64)}`,
            disposition: 'runnable',
        };
        expect(ExperimentalAgentProcessingClaimSchema.safeParse(claim).success).toBe(true);
        for (const disposition of ['runnable', 'stale_optional', 'blocked', 'already_superseded']) {
            const observed = { ...claim, disposition };
            expect(ExperimentalAgentProcessingClaimSchema.safeParse(observed).success).toBe(true);
            expect(validator('ExperimentalAgentProcessingClaim')(observed)).toBe(true);
        }
        expect(ExperimentalAgentProcessingClaimSchema.safeParse({ ...claim, disposition: 'ready' }).success).toBe(
            false,
        );
        expect(validator('ExperimentalAgentProcessingClaim')({ ...claim, disposition: 'ready' })).toBe(false);
        expect(ExperimentalAgentProcessingClaimSchema.safeParse({ ...claim, disposition: undefined }).success).toBe(
            false,
        );
        expect(validator('ExperimentalAgentProcessingClaim')({ ...claim, disposition: undefined })).toBe(false);
        expect(validator('ExperimentalClaimAgentProcessingPayload')(authority)).toBe(true);
        expect(validator('ExperimentalAgentProcessingClaim')(claim)).toBe(true);
        expect(ExperimentalAgentProcessingHeadPayloadSchema.parse(head)).toEqual(head);
        expect(ExperimentalCanonicalVersionedHeadPayloadSchema.parse(head)).toEqual(head);
        expect(validator('ExperimentalAgentProcessingHeadPayload')(head)).toBe(true);
        expect(validator('ExperimentalCanonicalVersionedHeadPayload')(head)).toBe(true);
        const initial = {
            kind: 'initial_agent',
            operation_id: 'initial:activity:one',
            request: {
                interaction: 'agent:test',
                initial_state: { type: 'document', document },
                retention: 'DEBUG',
                return_policy: { history: 'none' },
            },
            agent_acceptance: {
                version: 1,
                subject_agent_run_id: 'subject:one',
                activity_id: 'activity:one',
                scope: 'root',
            },
            activity_delivery: { activity_id: 'activity:one', run_id: 'actual:run', task_token: 'opaque-token' },
        };
        expect(ExperimentalCanonicalVersionedHeadPayloadSchema.safeParse(initial).success).toBe(true);
        expect(validator('ExperimentalCanonicalVersionedHeadPayload')(initial)).toBe(true);
        const ordinary = { document };
        expect(PublishAgentRunConversationHeadPayloadSchema.parse(ordinary)).toEqual(ordinary);
        expect(validator('PublishAgentRunConversationHeadPayload')(ordinary)).toBe(true);
    });

    test.each([
        ['missing branch', { expected_head: head.expected_head, document, processing_authority: authority }],
        ['unknown branch', { ...head, kind: 'arbitrary' }],
        ['missing authority', { kind: head.kind, expected_head: head.expected_head, document }],
        ['extra field', { ...head, claimed_ready: true }],
        ['missing token', { ...head, processing_authority: { ...authority, task_token: undefined } }],
    ])('%s rejects the same bytes in Zod and emitted AJV', (_name, value) => {
        expect(ExperimentalCanonicalVersionedHeadPayloadSchema.safeParse(value).success).toBe(false);
        expect(validator('ExperimentalCanonicalVersionedHeadPayload')(value)).toBe(false);
    });
});
