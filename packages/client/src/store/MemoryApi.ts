import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    AbandonMemoryRunPayload,
    CreateMemoryBrainPayload,
    CreateMemoryOntologyPayload,
    CreateMemoryRunPayload,
    DeleteMemoryBrainQuery,
    DeleteMemoryBrainResponse,
    ListMemoryRunOpsQuery,
    MemoryBrain,
    MemoryBrainActionResponse,
    MemoryCommitTicket,
    MemoryContextPack,
    MemoryEvidenceRef,
    MemoryFindEntitiesPayload,
    MemoryFindEntitiesResult,
    MemoryGeneration,
    MemoryGraphQuery,
    MemoryGraphQueryResult,
    MemoryNode,
    MemoryNodeEvidenceQuery,
    MemoryNodeEvidenceResponse,
    MemoryOntology,
    MemoryProjectionRebuildResponse,
    MemoryProjectionStatus,
    MemoryQueryPayload,
    MemoryReadGraphPayload,
    MemoryRunOpPage,
    MemoryRunSummary,
    MemoryStageOpsPayload,
    MemoryStageOpsResult,
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

    /**
     * Start a new Generation for a Brain.
     *
     * The Generation is built in the shadow: it answers no public query until it is promoted, which
     * is what lets a rebuild populate it over many bounded, committed runs without anyone reading a
     * half-built graph.
     */
    createGeneration(brainId: string): Promise<MemoryGeneration> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/generations`);
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

    /**
     * Read a run's operation ledger, in the order the run wrote it.
     *
     * A run receipt reports how many operations were refused; this reports which and under which
     * rule. Pass `status: 'refused'` to page only over those, which is what an operator asking why
     * a rebuild came out thin actually wants.
     */
    listRunOps(brainId: string, runId: string, query: ListMemoryRunOpsQuery = {}): Promise<MemoryRunOpPage> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/ops`, { query });
    }

    /** Execute a structured graph query against a Brain Generation. */
    queryGraph(brainId: string, query: MemoryGraphQuery): Promise<MemoryGraphQueryResult> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/query`, { payload: query });
    }

    /**
     * Expand from Nodes in the Brain's active Generation.
     *
     * This is how a caller walks the graph across several steps instead of asking one monolithic
     * question: each hop is authorized as the requesting principal, so what comes back is what that
     * principal may read rather than what the graph holds.
     */
    expandGraph(brainId: string, payload: MemoryReadGraphPayload): Promise<MemoryGraphQueryResult> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/graph/expand`, { payload });
    }

    /**
     * Fetch one Node by its opaque id. The id carries its Brain and Generation, so no other context
     * is needed.
     */
    getNode(nodeId: string): Promise<MemoryNode> {
        return this.get(`/nodes/${encodeURIComponent(nodeId)}`);
    }

    /**
     * Where a Node and each of its Statements came from.
     *
     * One row per derivation, so a Statement two sources support appears twice with its own basis
     * and citations each time. `facets` counts the whole readable result, not the returned page, so
     * the filter controls can be rendered without a second call.
     */
    getNodeEvidence(
        brainId: string,
        nodeId: string,
        query: MemoryNodeEvidenceQuery = {},
    ): Promise<MemoryNodeEvidenceResponse> {
        return this.get(`/brains/${encodeURIComponent(brainId)}/nodes/${encodeURIComponent(nodeId)}/evidence`, {
            query,
        });
    }

    getStatement(statementId: string): Promise<MemoryStatement> {
        return this.get(`/statements/${encodeURIComponent(statementId)}`);
    }

    /** The citations supporting a Statement, across all of its readable support groups. */
    getStatementEvidence(statementId: string): Promise<MemoryEvidenceRef[]> {
        return this.get(`/statements/${encodeURIComponent(statementId)}/evidence`);
    }

    /* ------------------------------------------------------------------------------------------ */
    /* Ontologies                                                                                  */
    /* ------------------------------------------------------------------------------------------ */

    listOntologies(): Promise<MemoryOntology[]> {
        return this.get('/ontologies');
    }

    getOntology(ontologyId: string, version: string): Promise<MemoryOntology> {
        return this.get(`/ontologies/${encodeURIComponent(ontologyId)}/${encodeURIComponent(version)}`);
    }

    /**
     * Create one version of an ontology.
     *
     * A version a Generation has been built against is immutable, so a vocabulary change is a new
     * version rather than an edit: the Statements citing the old one keep meaning what they meant.
     */
    createOntology(payload: CreateMemoryOntologyPayload): Promise<MemoryOntology> {
        return this.post('/ontologies', { payload });
    }

    /* ------------------------------------------------------------------------------------------ */
    /* Run lifecycle. Internal: these are how a reconstruction workflow writes to the store.       */
    /* ------------------------------------------------------------------------------------------ */

    /**
     * Claim a run against a Generation and freeze the sources it may cite.
     *
     * The vocabulary is not returned with it: the caller already froze the ontology into the
     * extraction context, and a second copy per attempt would be paid for nothing.
     */
    createRun(brainId: string, payload: CreateMemoryRunPayload): Promise<MemoryRunSummary> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/runs`, { payload });
    }

    /**
     * Stage a batch of operations on a run's ledger.
     *
     * Nothing reaches the graph here. Structurally invalid operations come back refused with the
     * rule that refused them rather than being dropped, and the persisted form of every accepted
     * operation is returned so a caller can compare it against what it submitted.
     */
    stageRunOps(brainId: string, runId: string, payload: MemoryStageOpsPayload): Promise<MemoryStageOpsResult> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/ops`, { payload });
    }

    /**
     * Close an attempt nobody will finish.
     *
     * A coordinator that gives up on a partition and claims a fresh run must say so, or the run it
     * walked away from reads as work still in flight forever. A run that already committed is left
     * exactly as it is and returned unchanged, which is what makes this safe to retry.
     */
    abandonRun(brainId: string, runId: string, payload: AbandonMemoryRunPayload = {}): Promise<MemoryRunSummary> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/actions/abandon`, {
            payload,
        });
    }

    /** Resolve a name to typed Nodes in the run's Generation, overlaid with the run's own writes. */
    findRunEntities(
        brainId: string,
        runId: string,
        payload: MemoryFindEntitiesPayload,
    ): Promise<MemoryFindEntitiesResult> {
        return this.post(
            `/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/graph/find-entities`,
            {
                payload,
            },
        );
    }

    /** Expand from seed Nodes, or match a structured pattern, inside the run's Generation. */
    readRunGraph(brainId: string, runId: string, payload: MemoryReadGraphPayload): Promise<MemoryGraphQueryResult> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/graph/read`, {
            payload,
        });
    }

    /**
     * Apply a run's staged operations in one transaction and return the commit ticket.
     *
     * The ticket is what makes a claimed commit checkable: its digest is recomputed from the ledger,
     * so a run that reports success without having committed cannot pass verification.
     */
    commitRun(brainId: string, runId: string): Promise<MemoryCommitTicket> {
        return this.post(`/brains/${encodeURIComponent(brainId)}/runs/${encodeURIComponent(runId)}/commit`);
    }

    /**
     * Ask Memory a question and get back a cited Context Pack.
     *
     * Every Statement returned carries at least one complete support group the caller may read; a
     * Node with no readable representation is left out entirely, paths and counts included. Limits
     * in the payload are requests the server may lower and never raises.
     *
     * Fails with a retryable 503 when the retrieval projection is unavailable — reads that address
     * an exact Node, Statement or Evidence id keep working.
     */
    query(payload: MemoryQueryPayload): Promise<MemoryContextPack> {
        return this.post('/query', { payload });
    }

    /**
     * Run a structured graph query with full support-group authorization.
     *
     * Unlike {@link queryGraph}, which inspects one Brain, this applies the same snapshot
     * authorization as {@link query}: unreadable Nodes are dropped from results, paths and bindings.
     */
    graphQuery(query: MemoryGraphQuery): Promise<MemoryGraphQueryResult> {
        return this.post('/graph-query', { payload: query });
    }

    /** Health of a Generation's retrieval projection: drift against canonical state, and lag. */
    getProjectionStatus(brainId: string, generationId?: string): Promise<MemoryProjectionStatus> {
        return this.get(`/projections/${encodeURIComponent(brainId)}`, {
            query: generationId ? { generation_id: generationId } : undefined,
        });
    }

    /**
     * Rebuild a Generation's projection from canonical state.
     *
     * The previous index stays queryable until the alias swap, so a failed rebuild leaves the last
     * good projection in place.
     */
    rebuildProjection(brainId: string, generationId?: string): Promise<MemoryProjectionRebuildResponse> {
        return this.post(`/projections/${encodeURIComponent(brainId)}/actions/rebuild`, {
            query: generationId ? { generation_id: generationId } : undefined,
        });
    }
}
