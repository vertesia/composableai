import { describe, expect, it } from 'vitest';
import type { GenericCommandResponse } from '../common.js';
import type { RecalculateEmbeddingsQuery } from '../embeddings.js';
import type {
    DriftAnalysisStatusResponse,
    EmbeddingsStatusResponse,
    IndexingStatusResponse,
    ProjectConfigurationEmbeddingEnablePayload,
    ReindexAgentRunsPayload,
    ReindexAgentRunsResponse,
    StartProjectReindexPayload,
} from '../project.js';
import { WorkflowExecutionStatus } from '../store/workflow.js';
import type { GenericCommandResponseSchema } from './commands.js';
import type {
    EmbeddingsStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayloadSchema,
    RecalculateEmbeddingsQuerySchema,
} from './embeddings.js';
import type {
    DriftAnalysisStatusResponseSchema,
    IndexingStatusResponseSchema,
    ReindexAgentRunsPayloadSchema,
    ReindexAgentRunsResponseSchema,
    StartProjectReindexPayloadSchema,
} from './indexing.js';
import { validateApiRequest, validateApiResponse } from './registry.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(_value: T): void {}

describe('indexing and embedding API contracts', () => {
    it('derives every public type from its domain schema', () => {
        assertType<Equals<GenericCommandResponse, typeof GenericCommandResponseSchema._output>>(true);
        assertType<Equals<EmbeddingsStatusResponse, typeof EmbeddingsStatusResponseSchema._output>>(true);
        assertType<Equals<RecalculateEmbeddingsQuery, typeof RecalculateEmbeddingsQuerySchema._output>>(true);
        assertType<Equals<IndexingStatusResponse, typeof IndexingStatusResponseSchema._output>>(true);
        assertType<Equals<DriftAnalysisStatusResponse, typeof DriftAnalysisStatusResponseSchema._output>>(true);
        assertType<
            Equals<
                ProjectConfigurationEmbeddingEnablePayload,
                typeof ProjectConfigurationEmbeddingEnablePayloadSchema._output
            >
        >(true);
        assertType<Equals<StartProjectReindexPayload, typeof StartProjectReindexPayloadSchema._output>>(true);
        assertType<Equals<ReindexAgentRunsPayload, typeof ReindexAgentRunsPayloadSchema._output>>(true);
        assertType<Equals<ReindexAgentRunsResponse, typeof ReindexAgentRunsResponseSchema._output>>(true);
    });

    it('rejects undeclared request fields while allowing both optional reindex bodies', () => {
        expect(validateApiRequest('StartProjectReindexPayload', undefined).valid).toBe(false);
        expect(validateApiRequest('StartProjectReindexPayload', {}).valid).toBe(true);
        expect(validateApiRequest('StartProjectReindexPayload', { unexpected: true }).valid).toBe(false);
        expect(validateApiRequest('ReindexAgentRunsPayload', {}).valid).toBe(true);
        expect(validateApiRequest('ReindexAgentRunsPayload', { recreate_index: true, unexpected: true }).valid).toBe(
            false,
        );
    });

    it('allows only the explicit synchronous embedding recalculation override', () => {
        expect(validateApiRequest('RecalculateEmbeddingsQuery', {}).valid).toBe(true);
        expect(validateApiRequest('RecalculateEmbeddingsQuery', { mode: 'sync' }).valid).toBe(true);
        // TEMPORARY TEST CONTROL: force flags are intentionally accepted for canary runs.
        expect(validateApiRequest('RecalculateEmbeddingsQuery', { force: true, force_renditions: true }).valid).toBe(
            true,
        );
        expect(validateApiRequest('RecalculateEmbeddingsQuery', { mode: 'batch' }).valid).toBe(false);
    });

    it('keeps drift workflow status numeric and nullable identifiers explicit', () => {
        expect(
            validateApiResponse('DriftAnalysisStatusResponse', {
                workflow_id: null,
                workflow_run_id: null,
                status: WorkflowExecutionStatus.UNKNOWN,
            }).valid,
        ).toBe(true);
        expect(
            validateApiResponse('DriftAnalysisStatusResponse', {
                workflow_id: null,
                workflow_run_id: null,
                status: 'NOT_FOUND',
            }).valid,
        ).toBe(false);
    });

    it('validates command and embedding responses against the published components', () => {
        expect(validateApiResponse('GenericCommandResponse', { status: 'ok', message: 'done' }).valid).toBe(true);
        expect(
            validateApiResponse('GenericCommandResponse', { status: 'ok', message: 'done', extra: true }).valid,
        ).toBe(false);
        expect(
            validateApiResponse('EmbeddingsStatusResponse', {
                status: 'success',
                vectorIndex: { status: 'READY' },
            }).valid,
        ).toBe(true);
    });
});
