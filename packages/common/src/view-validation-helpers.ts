export const VIEW_CONFIGURATION_ID_PATTERN_SOURCE = '^[a-z][a-z0-9_-]*$';
export const ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE = '^[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*$';

export const VIEW_CONFIGURATION_ID_PATTERN = new RegExp(VIEW_CONFIGURATION_ID_PATTERN_SOURCE);
export const ELASTICSEARCH_FIELD_PATH_PATTERN = new RegExp(ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE);

/**
 * Elasticsearch roots owned by the server and unavailable to View-authored
 * queries or dynamic collection filters.
 */
export const SERVER_CONTROLLED_VIEW_FIELD_ROOTS = [
    'security',
    'revision',
    'is_deleted',
    'embeddings_text',
    'embeddings_image',
    'embeddings_properties',
    '_indexing_metadata',
] as const;

/** @deprecated Use ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE. */
export const VIEW_FIELD_PATTERN_SOURCE = ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE;
/** @deprecated Use ELASTICSEARCH_FIELD_PATH_PATTERN. */
export const VIEW_FIELD_PATTERN = ELASTICSEARCH_FIELD_PATH_PATTERN;

export function isViewValidationRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
