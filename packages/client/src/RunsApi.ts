import type { ExecutionResponse } from '@llumiverse/common';
import { ApiTopic, type ClientBase, type IRequestParams } from '@vertesia/api-fetch-client';
import type {
    AppendRunConversationProgramTurnPayload,
    AppendRunConversationProgramTurnResponse,
    AppendRunConversationToolResultsPayload,
    AppendRunConversationToolResultsResponse,
    ComputeRunFacetPayload,
    ComputeRunFacetsResponse,
    ExecutionRun,
    ExecutionRunDocRef,
    ExecutionRunRef,
    ExperimentalCanonicalInteractionExecutionResult,
    ExperimentalCanonicalInteractionStreamEnvelope,
    ExperimentalCanonicalInteractionStreamRequest,
    ExperimentalCanonicalNamedInteractionExecutionRequest,
    ExperimentalCanonicalResumeAccepted,
    ExperimentalCanonicalToolResultsPayload,
    ExperimentalCanonicalUserMessagePayload,
    FindPayload,
    FindRunResult,
    InteractionExecutionResult,
    PopulatedExecutionRun,
    RunClonePayload,
    RunConversationResponse,
    RunCreatePayload,
    RunListingFilters,
    RunListingQueryOptions,
    RunSearchPayload,
    ToolResultsPayload,
    UserMessagePayload,
} from '@vertesia/common';
import { type CanonicalInteractionRequestOptions, canonicalInteractionHeaders } from './CanonicalInteractionApi.js';
import {
    type EnhancedExperimentalCanonicalInteractionExecutionResult,
    enhanceExperimentalCanonicalInteractionExecutionResult,
} from './CanonicalInteractionOutput.js';
import {
    CanonicalInteractionStreamProtocolError,
    type CanonicalInteractionStreamResult,
    type CanonicalInteractionStreamSessionOptions,
    consumeCanonicalInteractionStream,
} from './CanonicalInteractionStream.js';
import type { VertesiaClient } from './client.js';
import { INTERACTION_EXECUTION_TIMEOUT_MS } from './execute.js';
import {
    type EnhancedExecutionRun,
    type EnhancedInteractionExecutionResult,
    enhanceExecutionRun,
    enhanceInteractionExecutionResult,
} from './InteractionOutput.js';

export interface FilterOption {
    id: string;
    name: string;
    count: number;
}

export type { ComputeRunFacetsResponse } from '@vertesia/common';

type ResumeRequestOptions = Pick<IRequestParams, 'headers' | 'signal' | 'timeoutMs'>;

export type { CanonicalInteractionRequestOptions } from './CanonicalInteractionApi.js';

export class RunsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/runs');
    }

    /**
     * Get the list of all runs
     * @param project optional project id to filter by
     * @param interaction optional interaction id to filter by
     * @returns InteractionResult[]
     **/
    list({ limit, offset, filters }: RunListingQueryOptions): Promise<ExecutionRunRef[]> {
        const query = {
            limit,
            offset,
            ...filters,
        };

        return this.get('/', { query: query });
    }

    find(payload: FindPayload): Promise<FindRunResult[]> {
        return this.post('/find', {
            payload,
        });
    }

    /**
     * Get a run by id
     *
     * @param id
     * @returns InteractionResult
     **/
    async retrieve<ResultT = unknown, ParamsT = unknown>(id: string): Promise<EnhancedExecutionRun<ResultT, ParamsT>> {
        const r = await this.get<ExecutionRun<ParamsT>>(`/${id}`);
        return enhanceExecutionRun<ResultT, ParamsT>(r);
    }

    /** Retrieve the explicitly versioned experimental canonical execution envelope. */
    async retrieveCanonical<T = unknown>(
        id: string,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<EnhancedExperimentalCanonicalInteractionExecutionResult<T>> {
        const result = await this.get<ExperimentalCanonicalInteractionExecutionResult>(`/${encodeURIComponent(id)}`, {
            headers: canonicalInteractionHeaders(options?.headers),
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
        });
        return enhanceExperimentalCanonicalInteractionExecutionResult<T>(result);
    }

    /** Retrieve a retained canonical history, or the explicit reason it is unavailable. */
    retrieveConversation(id: string): Promise<RunConversationResponse> {
        return this.get(`/${encodeURIComponent(id)}/conversation`);
    }

    /** Durably append canonical tool results before the next model preparation. */
    appendConversationToolResults(
        id: string,
        payload: AppendRunConversationToolResultsPayload,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<AppendRunConversationToolResultsResponse> {
        return this.post(`/${encodeURIComponent(id)}/conversation/tool-results`, {
            payload,
            headers: canonicalInteractionHeaders(options?.headers),
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
        });
    }

    /** Durably append one server-owned ordinary program instruction. */
    appendConversationProgramTurn(
        id: string,
        payload: AppendRunConversationProgramTurnPayload,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<AppendRunConversationProgramTurnResponse> {
        return this.post(`/${encodeURIComponent(id)}/conversation/program-turns`, {
            payload,
            headers: canonicalInteractionHeaders(options?.headers),
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
        });
    }

    retrievePopulated<P = unknown>(id: string): Promise<PopulatedExecutionRun<P>> {
        return this.get(`/${id}`, {
            query: { populate: 'true' },
        });
    }

    /**
     * Get filter options for a field
     * return FilterOption[]
     */
    filterOptions(field: string, filters: RunListingFilters): Promise<FilterOption[]> {
        const query = {
            ...filters,
        };
        return this.get(`/filter-options/${field}`, { query });
    }

    async create<ResultT = unknown, ParamsT = unknown>(
        payload: RunCreatePayload,
        options?: { timeoutMs?: number | false | null; signal?: AbortSignal },
    ): Promise<EnhancedInteractionExecutionResult<ResultT, ParamsT>> {
        const sessionTags = (this.client as VertesiaClient).sessionTags;
        if (sessionTags) {
            let tags = Array.isArray(sessionTags) ? sessionTags : [sessionTags];
            if (Array.isArray(payload.tags)) {
                tags = tags.concat(payload.tags);
            } else if (payload.tags) {
                tags = tags.concat([payload.tags]);
            }
            payload = { ...payload, tags };
        }
        const r = await this.post<InteractionExecutionResult<ParamsT>>('/', {
            payload,
            timeoutMs: options?.timeoutMs,
            signal: options?.signal,
        });
        return enhanceInteractionExecutionResult<ResultT, ParamsT>(r);
    }

    /** Create a run through the explicitly versioned experimental canonical contract. */
    async createCanonical<T = unknown>(
        payload: ExperimentalCanonicalNamedInteractionExecutionRequest,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<EnhancedExperimentalCanonicalInteractionExecutionResult<T>> {
        const sessionTags = (this.client as VertesiaClient).sessionTags;
        if (sessionTags) {
            const tags = (Array.isArray(sessionTags) ? sessionTags : [sessionTags]).concat(payload.tags ?? []);
            payload = { ...payload, tags };
        }
        const result = await this.post<ExperimentalCanonicalInteractionExecutionResult>('/', {
            payload,
            headers: canonicalInteractionHeaders(options?.headers),
            timeoutMs: options?.timeoutMs ?? INTERACTION_EXECUTION_TIMEOUT_MS,
            signal: options?.signal,
        });
        return enhanceExperimentalCanonicalInteractionExecutionResult<T>(result);
    }

    /** Stream one explicitly versioned canonical interaction run with bounded reconnect validation. */
    async streamCanonical(
        payload: ExperimentalCanonicalInteractionStreamRequest,
        options: CanonicalInteractionStreamSessionOptions & CanonicalInteractionRequestOptions = {},
    ): Promise<CanonicalInteractionStreamResult> {
        const sessionTags = (this.client as VertesiaClient).sessionTags;
        if (sessionTags) {
            const tags = (Array.isArray(sessionTags) ? sessionTags : [sessionTags]).concat(payload.request.tags ?? []);
            payload = { ...payload, request: { ...payload.request, tags } };
        }
        return consumeCanonicalInteractionStream(
            {
                connect: async (request, onEnvelope) => {
                    const controller = new AbortController();
                    const abortFromCaller = () => controller.abort(options.signal?.reason);
                    if (options.signal?.aborted) abortFromCaller();
                    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
                    try {
                        await this.sseRequest(
                            'POST',
                            '/canonical-stream',
                            {
                                payload: request,
                                headers: canonicalInteractionHeaders(options.headers),
                                timeoutMs: options.timeoutMs ?? INTERACTION_EXECUTION_TIMEOUT_MS,
                                signal: controller.signal,
                            },
                            (event) => {
                                if (event.type !== 'event') return;
                                let envelope: ExperimentalCanonicalInteractionStreamEnvelope;
                                try {
                                    envelope = JSON.parse(event.data) as ExperimentalCanonicalInteractionStreamEnvelope;
                                } catch (cause) {
                                    throw new CanonicalInteractionStreamProtocolError(
                                        'Canonical interaction stream emitted invalid JSON',
                                        { cause },
                                    );
                                }
                                try {
                                    onEnvelope(envelope);
                                } catch (cause) {
                                    controller.abort(cause);
                                    throw cause;
                                }
                            },
                        );
                    } finally {
                        options.signal?.removeEventListener('abort', abortFromCaller);
                    }
                },
            },
            payload,
            options,
        );
    }

    /**
     * Send tool results and continues the conversation
     * @param payload
     * @returns
     */
    sendToolResults(payload: ToolResultsPayload, options?: ResumeRequestOptions): Promise<ExecutionResponse> {
        return this.post(`/tool-results`, {
            payload,
            headers: options?.headers,
            timeoutMs: options?.timeoutMs,
            signal: options?.signal,
        });
    }

    /** Resume through the exact experimental contract; content is acknowledged separately by Temporal. */
    sendCanonicalUserMessage(
        payload: ExperimentalCanonicalUserMessagePayload,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<ExperimentalCanonicalResumeAccepted> {
        return this.post('/user-message', {
            payload,
            headers: canonicalInteractionHeaders(options?.headers),
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
        });
    }

    sendCanonicalToolResults(
        payload: ExperimentalCanonicalToolResultsPayload,
        options?: CanonicalInteractionRequestOptions,
    ): Promise<ExperimentalCanonicalResumeAccepted> {
        return this.post('/tool-results', {
            payload,
            headers: canonicalInteractionHeaders(options?.headers),
            signal: options?.signal,
            timeoutMs: options?.timeoutMs,
        });
    }

    sendUserMessage(payload: UserMessagePayload, options?: ResumeRequestOptions): Promise<ExecutionResponse> {
        return this.post(`/user-message`, {
            payload,
            headers: options?.headers,
            timeoutMs: options?.timeoutMs,
            signal: options?.signal,
        });
    }

    /**
     * Get the list of all runs facets
     * @param payload query payload to filter facet search
     * @returns Facet buckets and the total number of matching runs
     **/
    computeFacets(query: ComputeRunFacetPayload): Promise<ComputeRunFacetsResponse> {
        return this.post('/facets', {
            payload: query,
        });
    }

    search(payload: RunSearchPayload): Promise<ExecutionRunRef[]> {
        return this.post('/search', {
            payload,
        });
    }

    /**
     * Clone an existing ExecutionRun for fork workflows.
     * Creates a new run with the same interaction/config but fresh status.
     */
    clone(payload: RunClonePayload): Promise<ExecutionRunDocRef> {
        return this.post('/clone', { payload });
    }
}
