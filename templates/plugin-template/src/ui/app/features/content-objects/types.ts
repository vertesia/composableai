import { ContentObjectStatus } from '@vertesia/common';

export type SortField = 'name' | 'type' | 'status' | 'updated';

// Elasticsearch text fields can't be sorted directly; use the .keyword sub-field.
// See ElasticsearchIndexManager BASE_INDEX_MAPPING_PROPERTIES.
export const SORT_FIELD_MAP: Record<SortField, string> = {
    name: 'name.keyword',
    type: 'type.name',
    status: 'status',
    updated: 'updated_at',
};

export const PAGE_SIZE = 50;

export const STATUS_VALUES = Object.values(ContentObjectStatus);

export type FilterableField = 'type' | 'status';

export type BadgeVariant =
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'attention'
    | 'success'
    | 'info'
    | 'done';
