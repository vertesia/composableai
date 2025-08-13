import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { Collection, CollectionItem, ComplexCollectionSearchQuery, ComplexSearchPayload, ComputeCollectionFacetPayload, ComputeObjectFacetPayload, ContentObjectItem, ContentObjectStatus, CreateCollectionPayload, DynamicCollection } from "@vertesia/common";
import { ComputeFacetsResponse } from "./ObjectsApi.js";


export class CollectionsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/collections");
    }

    /**
     * List collections
     * @param payload: CollectionSearchPayload
     * @returns CollectionItem[] list of collections
    **/
    search(payload: ComplexCollectionSearchQuery): Promise<CollectionItem[]> {
        return this.post("/search", { payload });
    }

    /**
     * Compute facets for List collections
     * @param query: ComputeCollectionFacetPayload
     * @returns ComputeFacetsResponse list of facets
    **/
    computeListFacets(query: ComputeCollectionFacetPayload): Promise<ComputeFacetsResponse> {
        return this.post("/facets", {
            payload: query
        });
    }

    /**
     * Get the collection data without members
     * @param collectionId
     * @returns
     */
    retrieve(collectionId: string): Promise<Collection | DynamicCollection> {
        return this.get(`/${collectionId}`);
    }

    create(payload: CreateCollectionPayload): Promise<Collection> {
        return this.post(`/`, {
            payload
        });
    }

    update(collectionId: string, payload: Partial<CreateCollectionPayload>): Promise<{ id: string }> {
        return this.put(`/${collectionId}`, {
            payload
        });
    }

    addMembers(collectionId: string, members: string[]): Promise<{ id: string }> {
        return this.post(`/${collectionId}/members`, {
            payload: {
                action: 'add',
                members
            }
        });
    }

    listMembers(collectionId: string, payload: {
        limit?: number,
        offset?: number,
        status?: ContentObjectStatus,
        type?: string,
    }): Promise<ContentObjectItem[]> {
        return this.get(`/${collectionId}/members`, {
            query: {
                ...payload
            }
        });
    }

    computeFacets(collectionId: string, query: ComputeObjectFacetPayload): Promise<ComputeFacetsResponse> {
        return this.post(`/${collectionId}/facets`, {
            payload: query
        });
    }

    searchMembers(collectionId: string, payload: ComplexSearchPayload): Promise<ContentObjectItem[]> {
        return this.post(`/${collectionId}/search`, { payload });
    }

    deleteMembers(collectionId: string, members: string[]): Promise<{ id: string }> {
        return this.post(`/${collectionId}/members`, {
            payload: {
                action: 'delete',
                members
            }
        });
    }

    delete(id: string) {
        return this.del(`/${id}`);
    }

    /**
     * Update collection permissions and propagate to member objects
     * @param collectionId - The collection ID
     * @param permissions - Map of permission types to principal arrays
     * @returns Object with collection id, updated security, and number of objects updated
     */
    updatePermissions(collectionId: string, permissions: Record<string, string[]>): Promise<{
        id: string;
        security: Record<string, string[]>;
        objectsUpdated: number;
    }> {
        return this.put(`/${collectionId}/permissions`, {
            payload: permissions
        });
    }

    /**
     * Manually trigger permission propagation from collection to member objects
     * Useful for debugging and fixing permission issues
     * @param collectionId - The collection ID
     * @returns Object with collection id, message, and number of objects updated
     */
    propagatePermissions(collectionId: string): Promise<{
        id: string;
        message: string;
        security?: Record<string, string[]>;
        objectsUpdated: number;
    }> {
        return this.post(`/${collectionId}/propagate-permissions`);
    }

}
