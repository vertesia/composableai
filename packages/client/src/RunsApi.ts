import type { ExecutionResponse } from '@llumiverse/common';
import { ApiTopic, type ClientBase, type IRequestParams } from '@vertesia/api-fetch-client';
import type {
    ComputeRunFacetPayload,
    ComputeRunFacetsResponse,
    ExecutionRun,
    ExecutionRunDocRef,
    ExecutionRunRef,
    FindPayload,
    FindRunResult,
    InteractionExecutionResult,
    PopulatedExecutionRun,
    RunClonePayload,
    RunCreatePayload,
    RunListingFilters,
    RunListingQueryOptions,
    RunSearchPayload,
    ToolResultsPayload,
    UserMessagePayload,
} from '@vertesia/common';
import type { VertesiaClient } from './client.js';
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

    /**
     *
     * @param payload
     * @returns
     */
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
