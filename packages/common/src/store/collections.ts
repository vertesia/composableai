import { BaseObject } from "./common.js";
import { ColumnLayout, ContentObjectTypeRef } from "./store.js";

export enum CollectionStatus {
    active = "active",
    archived = "archived",
}

export interface CreateCollectionPayload {
    name: string;
    dynamic: boolean;
    description?: string;
    tags?: string[];
    type?: string;
    query?: Record<string, any>;
    properties?: Record<string, any>;
    parent?: string | null;
    table_layout?: ColumnLayout[] | null;
    allowed_types?: string[];
    updated_by?: string,
    shared_properties?: string[];
}

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

export interface Collection extends CollectionItem {
    properties: Record<string, any>;
    query?: Record<string, any>;
    security?: Record<string, string[]>; // ACL for collection access
    /**
     * List of property names from the collection's properties that should be shared with (injected into) member objects.
     * These properties will be propagated to all members of this collection and merged as arrays.
     */
    shared_properties?: string[];
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
    parent?: string | null;
    dynamic?: boolean;
    status?: CollectionStatus;
    limit?: number;
    offset?: number;
    name?: string;
    type?: string;
    types?: string[];
}
