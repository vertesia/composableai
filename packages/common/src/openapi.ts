export interface OpenApiEmbedding {
    model: string;
    values: number[];
    etag?: string;
}

export interface OpenApiContentSource {
    source?: string;
    type?: string;
    name?: string;
    etag?: string;
}

export interface OpenApiContentObjectTypeRef {
    id?: string;
    code?: string;
    name: string;
}

export interface OpenApiContentObjectRevision {
    parent?: string;
    root: string;
    head: boolean;
    label?: string;
}

export interface OpenApiContentObjectUserPermissions {
    can_write: boolean;
    can_delete: boolean;
}

export interface OpenApiInheritedPropertyMetadata {
    name: string;
    collection: string;
}

export interface OpenApiContentObjectItem {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
    parent: string;
    location: string;
    status: string;
    type?: OpenApiContentObjectTypeRef;
    content: OpenApiContentSource;
    external_id?: string;
    properties: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tokens?: {
        count: number;
        encoding: string;
        etag: string;
    };
    revision: OpenApiContentObjectRevision;
    is_deleted?: boolean;
    is_locked?: boolean;
    score?: number;
    user_permissions?: OpenApiContentObjectUserPermissions;
}

export interface OpenApiContentObject extends OpenApiContentObjectItem {
    text?: string;
    text_etag?: string;
    embeddings?: Record<string, OpenApiEmbedding>;
    parts?: string[];
    parts_etag?: string;
    transcript?: Record<string, unknown>;
    security?: Record<string, string[]>;
    inherited_properties?: OpenApiInheritedPropertyMetadata[];
}

export interface OpenApiObjectSearchResponse {
    results: OpenApiContentObjectItem[];
    facets: Record<string, unknown>;
    aggregations?: Record<string, unknown>;
}

export interface OpenApiAdaptedTable {
    comment?: string;
    data: Record<string, unknown>[];
}

export interface OpenApiAdaptedTableResponse {
    [key: string]: OpenApiAdaptedTable;
}

export interface OpenApiDocTable {
    page_number?: number;
    table_number?: number;
    title?: string;
    format: 'application/csv' | 'application/json';
    data: string | Record<string, unknown>[];
}

export interface OpenApiAnnotatedPdfResponse {
    url: string | null;
}
