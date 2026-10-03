import {
    ProcessingJobSchema,
    ProcessingOutputReceiptSchema,
    type ProcessingReadinessCoverageSchema,
} from '@llumiverse/conversation/schemas';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { ApiSchemaComponents } from '../api-contract/index.js';
import type {
    ConversationProcessingJob,
    ConversationProcessingOutputReceipt,
    ConversationProcessingReadinessCoverage,
} from '../canonical-conversation.js';
import { CANONICAL_CONVERSATION_SCHEMAS } from './canonical-conversation.js';

describe('published canonical processing closure', () => {
    it('exports exact schema-inferred types for persisted jobs, outputs and readiness', () => {
        expectTypeOf<ConversationProcessingJob>().toEqualTypeOf<z.infer<typeof ProcessingJobSchema>>();
        expectTypeOf<ConversationProcessingOutputReceipt>().toEqualTypeOf<
            z.infer<typeof ProcessingOutputReceiptSchema>
        >();
        expectTypeOf<ConversationProcessingReadinessCoverage>().toEqualTypeOf<
            z.infer<typeof ProcessingReadinessCoverageSchema>
        >();
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationProcessingJob).toBe(ProcessingJobSchema);
        expect(CANONICAL_CONVERSATION_SCHEMAS.ConversationProcessingOutputReceipt).toBe(ProcessingOutputReceiptSchema);
    });

    it('enforces the same strict persisted job at Zod and the generated API boundary', () => {
        const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
        ajv.addSchema({ $id: 'vertesia://processing-test', components: { schemas: ApiSchemaComponents } });
        const validate = ajv.compile({
            $ref: 'vertesia://processing-test#/components/schemas/ConversationProcessingJob',
        });
        const job: ConversationProcessingJob = {
            id: 'job',
            source_operation_id: 'append',
            enqueue_revision: 1,
            policy_revision: 1,
            stage_index: 0,
            processor_index: 0,
            processor_id: 'minify',
            processor_version: 'v1',
            configuration_fingerprint: 'sha256:config',
            configuration: {},
            scope: 'on_append',
            required: true,
            failure_behavior: 'block',
            selection: { kind: 'entries', entry_ids: ['entry'] },
            selection_fingerprint: 'sha256:selection',
        };
        expect(ProcessingJobSchema.safeParse(job).success).toBe(true);
        expect(validate(job)).toBe(true);
        const unexpected = { ...job, unrecognized: true };
        expect(ProcessingJobSchema.safeParse(unexpected).success).toBe(false);
        expect(validate(unexpected)).toBe(false);
    });
});

import { Ajv2020 } from 'ajv/dist/2020.js';
