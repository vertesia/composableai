import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { Collection, CollectionItem, CollectionMembersSearchPayload, CollectionSearchPayload, ContentObjectItem, ContentObjectStatus, CreateCollectionPayload, DynamicCollection } from "@vertesia/common";


export class CollectionsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/collections");
    }

    /**
     * List collections
     * @param payload
     * @returns
     */
    list(payload: CollectionSearchPayload = {}): Promise<CollectionItem[]> {
        return this.get("/", {
            query: {
                limit: 100,
                offset: 0,
                ...payload
            }
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

    searchMembers(collectionId: string, payload: CollectionMembersSearchPayload): Promise<ContentObjectItem[]> {
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

}