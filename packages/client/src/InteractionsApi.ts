import { ApiTopic, ClientBase, ServerError } from "@vertesia/api-fetch-client";
import { AsyncExecutionPayload, ComputeInteractionFacetPayload, ExecutionRun, GenerateInteractionPayload, GenerateTestDataPayload, ImprovePromptPayload, Interaction, InteractionCreatePayload, InteractionEndpoint, InteractionEndpointQuery, InteractionExecutionPayload, InteractionExecutionResult, InteractionForkPayload, InteractionPublishPayload, InteractionRef, InteractionRefWithSchema, InteractionSearchPayload, InteractionSearchQuery, InteractionUpdatePayload, InteractionsExportPayload, RateLimitRequestPayload, RateLimitRequestResponse } from "@vertesia/common";
import { VertesiaClient } from "./client.js";
import { checkRateLimit, executeInteraction, executeInteractionAsync, executeInteractionByName } from "./execute.js";

export interface ComputeInteractionFacetsResponse {
    tags?: { _id: string, count: number }[];
    status?: { _id: string, count: number }[];
    total?: { count: number }[];
}

export interface AsyncExecutionResult {
    runId: string, workflowId: string
}

export default class InteractionsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/interactions");
    }

    /**
     * Get the list of all interactions in the current project
     * @returns InteractionRef[]
     **/
    list(payload: InteractionSearchPayload = {}): Promise<InteractionRef[]> {
        const query = payload.query || {} as InteractionSearchQuery;

        return this.get("/", {
            query: {
                ...query
            }
        });
    }
    /**
     * Find interactions given a mongo match query.
     * You can also specify if prompts schemas are included in the result
     */
    listEndpoints(payload: InteractionEndpointQuery): Promise<InteractionEndpoint[]> {
        return this.post("/endpoints", {
            payload
        });
    }

    /**
     * List all interaction versions in the project having the given endpoint name.
     * This is useful to list orphaned versions
     * @param name
     */
    listVersionsByName(name: string): Promise<InteractionRef[]> {
        return this.get(`/versions/${name}`);
    }

    /**
     * Get the list of all interactions facets
     * @param payload query payload to filter facet search
     * @returns ComputeInteractionFacetsResponse[]
     **/
    computeFacets(query: ComputeInteractionFacetPayload): Promise<ComputeInteractionFacetsResponse> {
        return this.post("/facets", {
            payload: query
        });
    }

    /**
     * List interaction names in the current project
     * @returns
     */
    listNames(): Promise<{ id: string, name: string }[]> {
        return this.get('/names');
    }

    /**
     * Get the list of all interactions in the current project. Schemas will be returned too.
     * @returns InteractionRefWithSchema[]
     **/
    export(payload: InteractionsExportPayload): Promise<InteractionRefWithSchema[]> {
        return this.post('/export', { payload });
    }

    /**
     * Create a new interaction
     * @param payload InteractionCreatePayload
     * @returns Interaction
     * @throws ApiError
     * @throws 400 if payload is invalid
     * @throws 500 if interaction creation fails
     **/
    create(payload: InteractionCreatePayload): Promise<Interaction> {
        return this.post('/', {
            payload
        });
    }

    /**
     * Retrieve an existing interaction definition
     * @param id of the interaction to retrieve
     * @returns Interaction
     **/
    retrieve(id: string): Promise<Interaction> {
        return this.get(`/${id}`);
    }

    /**
     * Update an existing interaction definition
     * @param id of the interaction to update
     * @param payload InteractionUpdatePayload
     * @returns Interaction
     * @throws ApiError
     * @throws 400 if payload is invalid
     * @throws 500 if interaction update fails
     * @throws 404 if interaction not found
     **/
    update(id: string, payload: InteractionUpdatePayload): Promise<Interaction> {
        return this.put(`/${id}`, {
            payload
        });
    }

    /**
     * Execute an interaction and return a promise which will be resolved with the executed run when
     * the run completes or fails.
     * If the onChunk callback is passed then the streaming of the result is enabled.
     * The onChunk callback with be called with the next chunk of the result as soon as it is available.
     * When all chunks are received the function will return the resolved promise
     * @param id of the interaction to execute
     * @param payload InteractionExecutionPayload
     * @param onChunk callback to be called when the next chunk of the response is available
     * @returns Promise<ExecutionRun>
     * @throws ApiError
     * @throws 404 if interaction not found
     * @throws 400 if payload is invalid
     * @throws 500 if interaction execution fails
     * @throws 500 if interaction execution times out
     **/
    execute<P = any, R = any>(id: string, payload: InteractionExecutionPayload = {},
        onChunk?: (chunk: string) => void): Promise<ExecutionRun<P, R>> {
        return executeInteraction<P, R>(this.client as VertesiaClient, id, payload, onChunk).catch(err => {
            if (err instanceof ServerError && err.payload?.id) {
                throw err.updateDetails({ run_id: err.payload.id });
            } else {
                throw err;
            }
        });
    }

    /**
     * Same as execute but uses the interaction name selector instead of the id.
     *
     * A name selector is the interaction endpoint name suffixed with an optional tag or version which is starting with a `@` character.
     * The special `draft` tag is used to select the draft version of the interaction. If no tag or version is specified then the latest version is selected.
     * Examples of selectors:
     * - `ReviewContract` - select the latest version of the ReviewContract interaction
     * - `ReviewContract@1` - select the version 1 of the ReviewContract interaction
     * - `ReviewContract@draft` - select the draft version of the ReviewContract interaction
     * - `ReviewContract@fixed` - select the ReviewContract interaction which is tagged with 'fixed' tag.
     * @param nameWithTag
     * @param payload
     * @param onChunk
     * @returns
     */
    executeByName<P = any, R = any>(nameWithTag: string, payload: InteractionExecutionPayload = {},
        onChunk?: (chunk: string) => void): Promise<InteractionExecutionResult<P, R>> {
        return executeInteractionByName<P, R>(this.client as VertesiaClient, nameWithTag, payload, onChunk).catch(err => {
            if (err instanceof ServerError && err.payload?.id) {
                throw err.updateDetails({ run_id: err.payload.id });
            } else {
                throw err;
            }
        });
    }

    /**
     * Execute an interaction in an workflow
     * @param payload
     * @returns
     */
    executeAsync(payload: AsyncExecutionPayload): Promise<AsyncExecutionResult> {
        return executeInteractionAsync(this.client as VertesiaClient, payload);
    }

    publish(id: string, payload: InteractionPublishPayload): Promise<Interaction> {
        return this.post(`/${id}/publish`, {
            payload
        });
    }

    fork(id: string, payload: InteractionForkPayload): Promise<Interaction> {
        return this.post(`/${id}/fork`, {
            payload
        });
    }

    /**
     * Generate Composable definition of an interaction
     **/
    generateInteraction(id: string, payload: GenerateInteractionPayload): Promise<any[]> {

        return this.post(`${id}/generate-interaction`, {
            payload
        });

    }

    /**
     * Generate Test Data for an interaction
     **/
    generateTestData(id: string, payload: GenerateTestDataPayload): Promise<any[]> {

        return this.post(`${id}/generate-test-data`, {
            payload
        });
    }

    /**
     * Suggest Improvement for a prompt
     */
    suggestImprovements(id: string, payload: ImprovePromptPayload): Promise<{ result: string; }> {
        return this.post(`${id}/suggest-prompt-improvements`, {
            payload
        });
    }

    /**
     * List the versions of the interaction. Returns an empty array if no versions are found
     * @param id
     * @returns the versions list or an empty array if no versions are found
     */
    listVersions(id: string): Promise<InteractionRef[]> {
        return this.get(`/${id}/versions`);
    }

    /**
     * List the forks of the interaction. Returns an empty array if no forks are found
     * @param id
     * @returns the versions list or an empty array if no forks are found
     */
    listForks(id: string): Promise<InteractionRef[]> {
        return this.get(`/${id}/forks`);
    }

    /**
     * Request a time slot to execute an interaction with a given environment / model
     * @param payload RateLimitRequestPayload
     * @returns RateLimitRequestResponse with delay_ms
     */
    requestSlot(payload: RateLimitRequestPayload): Promise<RateLimitRequestResponse> {
        return checkRateLimit(this.client as VertesiaClient, payload);
    }

}
