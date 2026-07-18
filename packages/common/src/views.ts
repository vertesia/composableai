import type { InteractionExecutionConfiguration } from './interaction.js';
import type { ContentObjectItemApiResponse } from './store/store.js';

export const VIEW_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ViewExperienceSchemaVersion = typeof VIEW_EXPERIENCE_SCHEMA_VERSION;

/** An author-provided Elasticsearch query subtree validated by the View runtime. */
export interface ViewElasticsearchQuery {
    [clause: string]: unknown;
}

export interface ViewExperienceLayout {
    mode?: 'browse' | 'worklist';
    navigation_position?: 'sidebar' | 'top' | 'drawer';
}

export interface ViewExperienceScope {
    type_ids?: string[];
    locations?: string[];
    collection_ids?: string[];
    include_collection_descendants?: boolean;
    fixed_filter?: ViewElasticsearchQuery;
    head_only?: boolean;
}

export interface ViewNavigationBase {
    id: string;
    label: string;
    presentation?: 'tree' | 'list' | 'select' | 'chips';
    multi_select?: boolean;
    order?: number;
    renderer?: string;
}

export interface ViewLocationNavigation extends ViewNavigationBase {
    source: 'location';
    roots?: string[];
    depth?: number;
}

export interface ViewCollectionNavigation extends ViewNavigationBase {
    source: 'collection';
    roots?: string[];
    include_descendants?: boolean;
}

export interface ViewTermsNavigation extends ViewNavigationBase {
    source: 'terms';
    field: string;
    size?: number;
    sort?: 'count' | 'label';
    missing_label?: string;
}

export interface ViewRangeDefinition {
    id: string;
    label: string;
    from?: number;
    to?: number;
}

export interface ViewRangeNavigation extends ViewNavigationBase {
    source: 'range';
    field: string;
    ranges: ViewRangeDefinition[];
}

export type ViewNavigationItem =
    | ViewLocationNavigation
    | ViewCollectionNavigation
    | ViewTermsNavigation
    | ViewRangeNavigation;

export interface ViewKeyTermDefinition {
    id: string;
    label: string;
    field?: string;
    type: 'text' | 'keyword' | 'number' | 'date' | 'boolean';
    multiple?: boolean;
    operator?: 'match' | 'term' | 'range';
}

export interface AgenticViewSearchAnnotationsConfiguration {
    mode?: 'none' | 'why_match' | 'answer';
    instructions?: string;
}

export interface AgenticViewSearchConfiguration {
    interaction?: string;
    config?: InteractionExecutionConfiguration;
    /** View-specific guidance for Elasticsearch query planning. */
    instructions?: string;
    mode?: 'query' | 'rerank' | 'curate';
    candidate_limit?: number;
    timeout_ms?: number;
    minimum_confidence?: number;
    annotations?: AgenticViewSearchAnnotationsConfiguration;
}

export interface ViewSearchConfiguration {
    renderer?: string;
    mode?: 'deterministic' | 'agentic';
    placeholder?: string;
    key_terms?: ViewKeyTermDefinition[];
    agentic?: AgenticViewSearchConfiguration;
}

export interface ViewSortClause {
    field: string;
    order: 'asc' | 'desc';
}

export interface ViewSortOption {
    id: string;
    label: string;
    sort: ViewSortClause[];
}

export type ViewResultFieldFormat = 'text' | 'date' | 'number' | 'badge' | 'user' | 'content_type' | 'location';

export interface ViewResultField {
    field: string;
    label?: string;
    format?: ViewResultFieldFormat;
    fallback?: string;
}

export interface ViewResultMedia {
    source: 'content_thumbnail' | 'property' | 'type_icon';
    field?: string;
    fit?: 'cover' | 'contain';
    fallback?: 'type_icon' | 'placeholder' | 'none';
}

export interface ViewDisplayBase {
    id: string;
    label: string;
    renderer?: string;
    page_size?: number;
}

export interface ViewListDisplay extends ViewDisplayBase {
    type: 'list';
    title: ViewResultField;
    subtitle?: ViewResultField[];
    description?: ViewResultField;
    media?: ViewResultMedia;
    badges?: ViewResultField[];
}

export interface ViewTableColumn extends ViewResultField {
    width?: number;
    sortable?: boolean;
    sort_option?: string;
}

export interface ViewTableDisplay extends ViewDisplayBase {
    type: 'table';
    columns: ViewTableColumn[];
}

export interface ViewCardsDisplay extends ViewDisplayBase {
    type: 'cards';
    title: ViewResultField;
    description?: ViewResultField;
    media?: ViewResultMedia;
    fields?: ViewResultField[];
    badges?: ViewResultField[];
    columns?: 2 | 3 | 4 | 5 | 6;
}

export interface ViewGalleryDisplay extends ViewDisplayBase {
    type: 'gallery';
    media: ViewResultMedia;
    title: ViewResultField;
    caption?: ViewResultField[];
    columns?: 2 | 3 | 4 | 5 | 6;
}

export interface ViewBoardColumn {
    value: string;
    label: string;
    order?: number;
}

export interface ViewBoardCardConfiguration {
    renderer?: string;
    page_size?: number;
    title: ViewResultField;
    description?: ViewResultField;
    media?: ViewResultMedia;
    fields?: ViewResultField[];
    badges?: ViewResultField[];
}

export interface ViewBoardDisplay extends ViewDisplayBase {
    type: 'board';
    group_by: string;
    columns?: ViewBoardColumn[];
    card: ViewBoardCardConfiguration;
}

export type ViewDisplayConfiguration =
    | ViewListDisplay
    | ViewTableDisplay
    | ViewCardsDisplay
    | ViewGalleryDisplay
    | ViewBoardDisplay;

export interface ViewResultsConfiguration {
    default_display: string;
    allow_display_switch?: boolean;
    displays: ViewDisplayConfiguration[];
    default_sort?: string;
    sort_options?: ViewSortOption[];
}

export interface ViewExperienceConfiguration {
    name: string;
    description?: string;
    enabled?: boolean;
    layout?: ViewExperienceLayout;
    scope?: ViewExperienceScope;
    navigation?: ViewNavigationItem[];
    search?: ViewSearchConfiguration;
    results?: ViewResultsConfiguration;
}

/** Project a persisted or extended View value back to its reusable configuration fields. */
export function getViewExperienceConfiguration(value: ViewExperienceConfiguration): ViewExperienceConfiguration {
    return {
        name: value.name,
        ...(value.description === undefined ? {} : { description: value.description }),
        ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
        ...(value.layout === undefined ? {} : { layout: value.layout }),
        ...(value.scope === undefined ? {} : { scope: value.scope }),
        ...(value.navigation === undefined ? {} : { navigation: value.navigation }),
        ...(value.search === undefined ? {} : { search: value.search }),
        ...(value.results === undefined ? {} : { results: value.results }),
    };
}

/** A View definition contributed by application code through the app package endpoint. */
export interface InCodeViewDefinition {
    /** App-local id. Studio normalizes it to app:<app-name>:<id>. */
    id: string;
    /** App-local name used for lookup and diagnostics. */
    name: string;
    title?: string;
    description?: string;
    tags?: string[];
    definition: ViewExperienceConfiguration;
}

export interface ViewExperience extends ViewExperienceConfiguration {
    id: string;
    version: ViewExperienceSchemaVersion;
    revision: number;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export interface CreateViewExperienceRequest extends ViewExperienceConfiguration {
    id: string;
    version?: ViewExperienceSchemaVersion;
}

/** PUT uses full replacement so omitted optional configuration is removed. */
export interface UpdateViewExperienceRequest extends ViewExperienceConfiguration {
    version: ViewExperienceSchemaVersion;
    revision: number;
}

export interface ViewExperienceListQuery {
    limit?: number;
    offset?: number;
}

export interface ExecuteViewRequest {
    query?: string;
    key_terms?: Record<string, string[]>;
    navigation?: Record<string, string[]>;
    display?: string;
    sort?: string;
    offset?: number;
    limit?: number;
}

export interface ViewExecutionWarning {
    code: string;
    message: string;
    path?: string;
}

export type ViewQueryPlanningFailureCode =
    | 'interaction_failed'
    | 'invalid_output'
    | 'invalid_query'
    | 'low_confidence'
    | 'timeout'
    | 'unknown';

/**
 * Safe query-planning diagnostics. The query contains only the model-authored
 * subtree; server-owned scope and content-security filters are never exposed.
 */
export interface ViewExecutionQueryPlan {
    status: 'applied' | 'fallback';
    query?: ViewElasticsearchQuery;
    confidence?: number;
    error_code?: ViewQueryPlanningFailureCode;
    error_message?: string;
}

export interface ViewHitAnnotation {
    why_match?: string;
    answer?: string;
    excerpt?: string;
}

export interface ViewHit {
    id: string;
    score?: number;
    document: ContentObjectItemApiResponse;
    annotation?: ViewHitAnnotation;
}

export interface ViewNavigationNode {
    id: string;
    label: string;
    count: number;
    selected?: boolean;
    expandable?: boolean;
    children?: ViewNavigationNode[];
    path?: string;
}

export interface ViewNavigationResult {
    id: string;
    selected: string[];
    nodes: ViewNavigationNode[];
    truncated?: boolean;
}

export interface ViewExecutionSearchResult {
    input?: string;
    interpretation?: string;
    key_terms?: Record<string, string[]>;
    plan?: ViewExecutionQueryPlan;
    requested_mode: 'browse' | 'deterministic' | 'agentic';
    applied_mode: 'browse' | 'deterministic' | 'query' | 'rerank' | 'curate';
    fallback_reason?: string;
    warnings: ViewExecutionWarning[];
}

export interface ViewExecutionResult {
    view: string;
    revision: number;
    /** The authoritative runtime-safe definition resolved by Zeno for this execution. */
    definition: ViewExperienceConfiguration;
    display?: string;
    sort?: string;
    search: ViewExecutionSearchResult;
    hits: ViewHit[];
    total: number;
    navigation: Record<string, ViewNavigationResult>;
    took: number;
}
