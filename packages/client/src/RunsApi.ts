import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    ComputeRunFacetPayload,
    ExecutionRun,
    ExecutionRunRef,
    FindPayload,
    RunCreatePayload,
    RunListingFilters,
    RunListingQueryOptions,
    RunSearchPayload,
    ToolResultsPayload,
} from "@vertesia/common";
import { VertesiaClient } from "./client.js";
import { ExecutionResponse } from "@llumiverse/core";

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
    total?: { count: number }[];
}

export class RunsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/runs");
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

        return this.get("/", { query: query });
    }

    find(payload: FindPayload): Promise<ExecutionRun[]> {
        return this.post("/find", {
            payload,
        });
    }

    /**
     * Get a run by id
     *
     * @param id
     * @returns InteractionResult
     **/
    retrieve<P = any, R = any>(id: string): Promise<ExecutionRun<P, R>> {
        return this.get("/" + id);
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

    create(payload: RunCreatePayload): Promise<ExecutionRun> {
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
        return this.post("/", {
            payload,
        });
    }

    sendToolResults(payload: ToolResultsPayload): Promise<ExecutionResponse> {
        return this.post(`/tool-results`, {
            payload,
        });
    }

    createCheckpoint(payload: ToolResultsPayload): Promise<ExecutionResponse> {
        return this.post(`/checkpoints`, {
            payload,
        });
    }

    /**
     * Get the list of all runs facets
     * @param payload query payload to filter facet search
     * @returns ComputeRunFacetsResponse[]
     **/
    computeFacets(query: ComputeRunFacetPayload): Promise<ComputeRunFacetsResponse> {
        return this.post("/facets", {
            payload: query,
        });
    }

    search(payload: RunSearchPayload): Promise<ExecutionRunRef[]> {
        return this.post("/search", {
            payload,
        });
    }
}
