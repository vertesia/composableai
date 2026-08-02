import type { z } from 'zod';
import type {
    CollectionChildrenUpdatePayloadSchema,
    CollectionChildrenUpdateResultSchema,
    CollectionMembersQuerySchema,
    CollectionMembersUpdatePayloadSchema,
    CollectionMembersUpdateResultSchema,
    CollectionPropagationResponseSchema,
    CollectionSchema,
    CollectionSecuritySettingsResponseSchema,
    CreateCollectionPayloadSchema,
} from '../api-schemas/content.js';
import type { BaseObject } from './common.js';
import type { ColumnLayout, ContentObjectTypeRef } from './store.js';

export enum CollectionStatus {
    active = 'active',
    archived = 'archived',
}

export type CreateCollectionPayload = z.infer<typeof CreateCollectionPayloadSchema>;

export interface CollectionItem extends BaseObject {
    /**
     * A flag to indicate if the collection is dynamic or static.
     * If the collection is dynamic, the members are determined by a query using the query field.
     * If the collection is static, the members are explicitly defined using the members array.
     */
    dynamic: boolean;
    status: CollectionStatus;
    // A ref to the object type
    type?: ContentObjectTypeRef;
    /**
     * A flag to indicate whether to track and sync member HEAD revisions.
     * The default is to sync HEAD revisions for collection members (skip_head_sync: false)
     */
    skip_head_sync: boolean;
    /**
     * The parent collections if any.
     * A collection can have multiple parents.
     */
    parents?: string[] | null;
    /**
     * The table layout to use for the collection.
     * The layout defined in the type could serve as a fallback if not defined here.
     */
    table_layout?: ColumnLayout[];

    /**
     * The allowed types for the collection.
     */
    allowed_types?: string[];
}

export type Collection = z.infer<typeof CollectionSchema>;

export interface StaticCollection extends Collection {
    dynamic: false;
    members: string[];
    query: never;
}

export interface DynamicCollection extends Collection {
    dynamic: true;
}

export interface CollectionSearchPayload {
    parent?: string | null;
    dynamic?: boolean;
    status?: CollectionStatus;
    limit?: number;
    offset?: number;
    name?: string;
    type?: string;
    types?: string[];
}

export type CollectionMembersUpdateResult = z.infer<typeof CollectionMembersUpdateResultSchema>;

export type CollectionSecuritySettingsResponse = z.infer<typeof CollectionSecuritySettingsResponseSchema>;

export type CollectionPropagationResponse = z.infer<typeof CollectionPropagationResponseSchema>;

export type CollectionChildrenUpdateResult = z.infer<typeof CollectionChildrenUpdateResultSchema>;

export type CollectionMembersUpdatePayload = z.infer<typeof CollectionMembersUpdatePayloadSchema>;

export type CollectionChildrenUpdatePayload = z.infer<typeof CollectionChildrenUpdatePayloadSchema>;

export type CollectionMembersQuery = z.infer<typeof CollectionMembersQuerySchema>;
