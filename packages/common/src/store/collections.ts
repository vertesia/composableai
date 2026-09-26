import type * as Wire from '../wire-types.generated.js';
import type { BaseObject } from './common.js';
import type { ColumnLayout, ContentObjectTypeRef } from './store.js';

export enum CollectionStatus {
    active = 'active',
    archived = 'archived',
}

export type CreateCollectionPayload = Wire.CreateCollectionPayload;

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

export type Collection = Wire.Collection;

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

export type CollectionMembersUpdateResult = Wire.CollectionMembersUpdateResult;

export type CollectionSecuritySettingsResponse = Wire.CollectionSecuritySettingsResponse;

export type CollectionPropagationResponse = Wire.CollectionPropagationResponse;

export type CollectionChildrenUpdateResult = Wire.CollectionChildrenUpdateResult;

export type CollectionMembersUpdatePayload = Wire.CollectionMembersUpdatePayload;

export type CollectionChildrenUpdatePayload = Wire.CollectionChildrenUpdatePayload;

export type CollectionMembersQuery = Wire.CollectionMembersQuery;

export type UpdateCollectionPayload = Wire.UpdateCollectionPayload;
