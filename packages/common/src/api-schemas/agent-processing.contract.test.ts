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
function validator(name: string) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    addFormats.default(ajv);
    return ajv.compile({ components: { schemas: ApiSchemaComponents }, $ref: `#/components/schemas/${name}` });
}

describe('published native processing evidence', () => {
    test('published Zod and AJV accept the exact claim and disposition evidence', () => {
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
    });
});
