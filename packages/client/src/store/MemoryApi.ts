import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateMemoryBrainPayload,
    DeleteMemoryBrainQuery,
    DeleteMemoryBrainResponse,
    MemoryBrain,
    MemoryBrainActionResponse,
    MemoryEvidenceRef,
    MemoryGeneration,
    MemoryGraphQuery,
    MemoryGraphQueryResult,
    MemoryNode,
    MemoryRunSummary,
    MemoryStatement,
    UpdateMemoryBrainPayload,
} from '@vertesia/common';

/**
 * Administration of Memory Brains and the record namespaces they own.
 */
export class MemoryApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/memory');
    }

    /**
     * Delete a Memory Brain definition and, with `purge_records: true`, every record in its
     * namespace — that is every content object whose `properties.brain_id` equals `brainId`.
     *
     * The summary reports partial failures rather than the call failing outright, so a caller can
     * retry the remainder.
     *
     * @param brainId the `brain_id` of the Brain, not the content object id
     * @param options cascade and content-type-naming overrides
     */
    deleteBrain(brainId: string, options: DeleteMemoryBrainQuery = {}): Promise<DeleteMemoryBrainResponse> {
        return this.del(`/brains/${encodeURIComponent(brainId)}`, { query: options });
    }

    /** List the Brains of the current project, newest first. */
    listBrains(): Promise<MemoryBrain[]> {
        return this.get('/brains');
    }

    createBrain(payload: CreateMemoryBrainPayload): Promise<MemoryBrain> {
        return this.post('/brains', { payload });
    }

    getBrain(brainId: string): Promise<MemoryBrain> {
        return this.get(`/brains/${encodeURIComponent(brainId)}`);
    }

    /**
     * Update a Brain under optimistic concurrency. `payload.expected_revision` must be the revision
     * the caller read; a concurrent update makes this fail with 409 rather than overwriting.
     */
    updateBrain(brainId: string, payload: UpdateMemoryBrainPayload): Promise<MemoryBrain> {
        return this.put(`/brains/${encodeURIComponent(brainId)}`, { payload });
    }

    /** Stop new source processing. Queries against the active Generation keep working. */
    pauseBrain(brainId: string): Promise<MemoryBrainActionResponse> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/actions/pause`);
    }

    resumeBrain(brainId: string): Promise<MemoryBrainActionResponse> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/actions/resume`);
    }

    /** Stop processing and make configuration and graph state read-only. */
    archiveBrain(brainId: string): Promise<MemoryBrainActionResponse> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/actions/archive`);
    }

    /**
     * Point the Brain at a built Generation. One optimistic-concurrency pointer change: it fails
     * rather than switching when the Brain moved on since `expectedRevision` was read.
     */
    promoteGeneration(
        brainId: string,
        generationId: string,
        expectedRevision: number,
    ): Promise<MemoryBrainActionResponse> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/actions/promote`, {
            payload: { generation_id: generationId, expected_revision: expectedRevision },
        });
    }

    listGenerations(brainId: string): Promise<MemoryGeneration[]> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/generations`);
    }

    getGeneration(brainId: string, generationId: string): Promise<MemoryGeneration> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/generations/${encodeURIComponent(generationId)}`);
    }

    listRuns(brainId: string): Promise<MemoryRunSummary[]> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/runs`);
    }

    getRun(brainId: string, runId: string): Promise<MemoryRunSummary> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}`);
    }

    /** Execute a structured graph query against a Brain Generation. */
    queryGraph(brainId: string, query: MemoryGraphQuery): Promise<MemoryGraphQueryResult> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/query`, { payload: query });
    }

    /**
     * Fetch one Node by its opaque id. The id carries its Brain and Generation, so no other context
     * is needed.
     */
    getNode(nodeId: string): Promise<MemoryNode> {
        return this.get(`/nodes/${encodeURIComponent(nodeId)}`);
    }

    getStatement(statementId: string): Promise<MemoryStatement> {
        return this.get(`/statements/${encodeURIComponent(statementId)}`);
    }

    /** The citations supporting a Statement, across all of its readable support groups. */
    getStatementEvidence(statementId: string): Promise<MemoryEvidenceRef[]> {
        return this.get(`/statements/${encodeURIComponent(statementId)}/evidence`);
    }
}
