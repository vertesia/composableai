import type { ExecutionResponse } from '@llumiverse/common';
import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ComputeRunFacetPayload,
    ExecutionRun,
    ExecutionRunDocRef,
    ExecutionRunRef,
    FindPayload,
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
import { type EnhancedExecutionRun, enhanceExecutionRun } from './InteractionOutput.js';

export interface FilterOption {
    id: string;
    name: string;
    count: number;
}

export interface ComputeRunFacetsResponse {
    environments?: { _id: string; count: number }[];
    interactions?: { _id: string; count: number }[];
    models?: { _id: string; count: number }[];
    tags?: { _id: string; count: number }[];
    status?: { _id: string; count: number }[];
    total?: number;
}

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

    find(payload: FindPayload): Promise<ExecutionRun[]> {
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
    ): Promise<EnhancedExecutionRun<ResultT, ParamsT>> {
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
        const client = this.client as VertesiaClient;
        const r = await client.post<ExecutionRun<ParamsT>>(client.getInferenceUrl('/api/v1/inference/runs'), {
            payload,
        });
        return enhanceExecutionRun<ResultT, ParamsT>(r);
    }

    /**
     * Send tool results and continues the conversation
     * @param payload
     * @returns
     */
    sendToolResults(payload: ToolResultsPayload): Promise<ExecutionResponse> {
        const client = this.client as VertesiaClient;
        return client.post(client.getInferenceUrl('/api/v1/inference/runs/tool-results'), {
            payload,
        });
    }

    /**
     *
     * @param payload
     * @returns
     */
    sendUserMessage(payload: UserMessagePayload): Promise<ExecutionResponse> {
        const client = this.client as VertesiaClient;
        return client.post(client.getInferenceUrl('/api/v1/inference/runs/user-message'), {
            payload,
        });
    }

    /**
     * Get the list of all runs facets
     * @param payload query payload to filter facet search
     * @returns ComputeRunFacetsResponse[]
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
