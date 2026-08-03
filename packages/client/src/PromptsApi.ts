import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ComputedFacetResponse,
    ComputePromptFacetPayload,
    PromptSearchPayload,
    PromptSearchQuery,
    PromptTemplate,
    PromptTemplateCreatePayload,
    PromptTemplateForkPayload,
    PromptTemplateInteractionsResponse,
    PromptTemplateRef,
    PromptTemplateUpdatePayload,
    RenderPromptResponse,
} from '@vertesia/common';

/**
 * @deprecated Use `ComputedFacetResponse` from `@vertesia/common`, which is what the endpoint
 * publishes. This restated the facet buckets in their pre-collapse shape: `total` is a number by
 * the time the response is written, not a one-element array.
 */
export type ComputePromptFacetsResponse = ComputedFacetResponse;

/** @deprecated Use `RenderPromptResponse` from `@vertesia/common`. */
export type PromptRenderResponse = RenderPromptResponse;

export default class PromptsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/prompts');
    }

    /**
     * Get the list of all prompt templates
     * @param payload query payload to filter search
     * @returns PromptTemplateRef[]
     **/
    list(payload: PromptSearchPayload = {}): Promise<PromptTemplateRef[]> {
        const query = payload.query || ({} as PromptSearchQuery);

        return this.get('/', {
            query: {
                ...query,
            },
        });
    }

    /**
     * Get the list of all prompt facets
     * @param payload query payload to filter facet search
     * @returns ComputedFacetResponse
     **/
    computeFacets(query: ComputePromptFacetPayload): Promise<ComputedFacetResponse> {
        return this.post('/facets', {
            payload: query,
        });
    }

    /**
     * Create a new prompt template
     * @param payload PromptTemplateCreatePayload
     * @returns PromptTemplate
     * @throws ApiError
     * @throws 400 if payload is invalid
     * @throws 500 if creation fails
     **/
    create(payload: PromptTemplateCreatePayload): Promise<PromptTemplate> {
        return this.post('/', {
            payload,
        });
    }

    /**
     * Retrieve an existing prompt template
     * @param id of the prompt template to retrieve
     * @returns PromptTemplate
     **/
    retrieve(id: string): Promise<PromptTemplate> {
        return this.get(`/${id}`);
    }

    /**
     * Update an existing prompt template
     * @param id of the prompt template to update
     * @param payload PromptTemplateCreatePayload
     * @returns PromptTemplate
     * @throws ApiError
     * @throws 400 if payload is invalid
     * @throws 500 if update fails
     * @throws 404 if not found
     **/
    update(id: string, payload: PromptTemplateUpdatePayload): Promise<PromptTemplate> {
        return this.put(`/${id}`, {
            payload,
        });
    }

    /**
     * Delete an existing prompt template
     * @param id of the prompt template to delete
     * @returns void
     */
    delete(id: string): Promise<void> {
        return this.del(`/${id}`);
    }

    /**
     * Fork an existing prompt template
     * @param id of the prompt template to fork
     * @param payload PromptTemplateForkPayload
     * @returns Forked PromptTemplate
     */
    fork(id: string, payload: PromptTemplateForkPayload): Promise<PromptTemplate> {
        return this.post(`/${id}/fork`, {
            payload,
        });
    }

    /**
     * Render a prompt template with the given variables.
     * @param id of the prompt template to render
     * @param payload variables to apply to the template
     * @returns { id, name, role, content_type, rendered }
     * @throws ApiError
     * @throws 404 if not found
     * @throws 403 if the prompt is not in the current project
     */
    render(id: string, payload: object): Promise<RenderPromptResponse> {
        return this.post(`/${id}/render`, {
            payload,
        });
    }

    //TODO - Does this exist?
    /**
     * Get options for a field
     * @param field name to get options for
     * @returns string[]
     */
    options(field: string): Promise<string[]> {
        return this.get(`/options/${field}`);
    }

    /**
     * List the versions of the prompt template. Returns an empty array if no versions are found
     * @param id
     * @returns the versions list or an empty array if no versions are found
     */
    listVersions(id: string): Promise<PromptTemplateRef[]> {
        return this.get(`/${id}/versions`);
    }

    /**
     * Retrieve list of interactions that use the prompt template
     */
    listInteractions(id: string): Promise<PromptTemplateInteractionsResponse> {
        return this.get(`/${id}/interactions`);
    }

    /**
     * List the forks of the prompt. Returns an empty array if no forks are found
     * @param id of the prompt to search forks
     * @returns the versions list or an empty array if no forks are found
     */
    listForks(id: string): Promise<PromptTemplateRef[]> {
        return this.get(`/${id}/forks`);
    }
}

/**
 * @deprecated Use `PromptTemplateInteractionsResponse` from `@vertesia/common`, which is what the
 * endpoint publishes. This declared `versions: string[]`; the endpoint has always sent
 * `[{ version: number }]`.
 */
export type ListInteractionsResponse = PromptTemplateInteractionsResponse;
