import { BaseObject } from "./common.js";
import { ContentObjectTypeRef } from "./store.js";

export enum CollectionStatus {
    active = 'active',
    archived = 'archived'
}

export interface CreateCollectionPayload {
    name: string;
    dynamic: boolean;
    description?: string;
    tags?: string[];
    type?: string;
    query?: Record<string, any>;
    properties?: Record<string, any>;
}

export interface CollectionItem extends BaseObject {
    /**
     * A flag to indicate if the collection is dynamic or static.
     * If the collection is dynamic, the members are determined by a query using the query field.
     * Id the collection is static, the members are explicitly defined jusing the members array.
     */
    dynamic: boolean;
    status: CollectionStatus;
    // A ref to the object type
    type?: ContentObjectTypeRef;
}

export interface Collection extends CollectionItem {
    properties: Record<string, any>;
    query?: Record<string, any>;
}

export interface StaticCollection extends Collection {
    dynamic: false;
    members: string[];
    query: never;
}

export interface DynamicCollection extends Collection {
    dynamic: true;
}

export interface CollectionSearchPayload {
    dynamic?: boolean;
    status?: CollectionStatus;
    limit?: number;
    offset?: number;
}

export interface CollectionMembersSearchPayload {
    limit?: number,
    offset?: number,
    query?: Record<string, any>
}