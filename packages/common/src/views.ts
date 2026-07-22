import type { InteractionExecutionConfiguration } from './interaction.js';
import type { JSONObject } from './json.js';
import type { ContentObjectItemApiResponse } from './store/store.js';

export const VIEW_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ViewExperienceSchemaVersion = typeof VIEW_EXPERIENCE_SCHEMA_VERSION;

/** Build the generic reusable client route for a persisted, system, or app-contributed View. */
export function viewExperienceRoute(id: string): string {
    return `/view/${encodeURIComponent(id)}`;
}

/** An author-provided Elasticsearch query subtree validated by the View runtime. */
export interface ViewElasticsearchQuery {
    [clause: string]: unknown;
}

export interface ViewExperienceLayout {
    mode?: 'browse' | 'worklist';
    navigation_position?: 'sidebar' | 'top';
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
}

export interface ViewHierarchyLevel {
    id: string;
    label: string;
    field: string;
    size?: number;
    sort?: 'count' | 'label';
}

/**
 * A drill-down hierarchy assembled from independently mapped properties.
 *
 * Hierarchies represent one selected path, so multi_select may only be false.
 * Selection ids are opaque runtime values and must not be constructed by clients.
 */
export interface ViewHierarchyNavigation extends ViewNavigationBase {
    source: 'hierarchy';
    levels: ViewHierarchyLevel[];
    multi_select?: false;
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
    | ViewHierarchyNavigation
    | ViewRangeNavigation;

export interface ViewKeyTermDefinition {
    id: string;
    label: string;
    field?: string;
    type: ViewSearchFieldType;
    multiple?: boolean;
    operator?: 'match' | 'term' | 'range';
}

export const VIEW_SEARCH_FIELD_TYPES = ['text', 'keyword', 'number', 'date', 'boolean'] as const;

export type ViewSearchFieldType = (typeof VIEW_SEARCH_FIELD_TYPES)[number];

/**
 * A mapped Elasticsearch field that a View may use for query planning and
 * deterministic full-text fallback.
 */
export interface ViewSearchFieldDefinition {
    field: string;
    /** Meaning of the field for query planners, for example "Full OCR text". */
    description?: string;
    /** Mapping hint used only when the active index mapping does not expose a type. */
    type?: ViewSearchFieldType;
    /**
     * `full_text` enables scoring text queries, `exact` limits the field to
     * structured operators, and `auto` derives behavior from the mapped type.
     */
    mode?: 'auto' | 'full_text' | 'exact';
    /** Relative boost when this field participates in multi-field text search. */
    boost?: number;
}

export const VIEW_AGENTIC_SEARCH_MODES = ['query', 'query_and_view'] as const;

export type ViewAgenticSearchMode = (typeof VIEW_AGENTIC_SEARCH_MODES)[number];

export interface AgenticViewRerankConfiguration {
    /** Interaction used only for candidate reranking. Defaults to sys:ContentSearchReranker. */
    interaction?: string;
    /** Maximum candidates from the current result page sent to the model. */
    max_candidates?: number;
    /** Ask the model for a short per-result explanation. Defaults to true. */
    include_why_match?: boolean;
    /** Reranking-stage timeout. */
    timeout_ms?: number;
}

export interface AgenticViewSearchConfiguration {
    interaction?: string;
    config?: InteractionExecutionConfiguration;
    /** View-specific guidance for Elasticsearch query planning. */
    instructions?: string;
    /** Generate only Elasticsearch DSL, or generate DSL plus a safe ephemeral result presentation. */
    mode?: ViewAgenticSearchMode;
    timeout_ms?: number;
    minimum_confidence?: number;
    /** Optional second stage that reorders an authorized candidate page using the same model configuration. */
    rerank?: AgenticViewRerankConfiguration;
}

export interface ViewSearchConfiguration {
    renderer?: string;
    mode?: 'deterministic' | 'agentic';
    placeholder?: string;
    fields?: ViewSearchFieldDefinition[];
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

export const VIEW_RESULT_FIELD_FORMATS = [
    'text',
    'date',
    'number',
    'badge',
    'user',
    'content_type',
    'location',
] as const;

export type ViewResultFieldFormat = (typeof VIEW_RESULT_FIELD_FORMATS)[number];

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

export const VIEW_SELECTION_MODES = ['single', 'multiple'] as const;

export type ViewSelectionMode = (typeof VIEW_SELECTION_MODES)[number];

/** Client-side selection behavior for normalized View hits. */
export interface ViewSelectionConfiguration {
    mode: ViewSelectionMode;
    /** Select-all applies to the currently rendered page. */
    select_all?: 'page';
}

export const VIEW_ACTION_PLACEMENTS = ['toolbar', 'row', 'selection'] as const;

export type ViewActionPlacement = (typeof VIEW_ACTION_PLACEMENTS)[number];

export const VIEW_ACTION_SELECTION_REQUIREMENTS = ['none', 'single', 'multiple', 'any'] as const;

export type ViewActionSelectionRequirement = (typeof VIEW_ACTION_SELECTION_REQUIREMENTS)[number];

/**
 * Declarative action exposed by a View. The handler name is resolved by the
 * embedding application; persisted configuration never contains executable code.
 */
export interface ViewActionConfiguration {
    id: string;
    label: string;
    handler: string;
    placement?: ViewActionPlacement;
    requires_selection?: ViewActionSelectionRequirement;
    destructive?: boolean;
    confirm?: boolean;
    params?: JSONObject;
}

export interface ViewActionsConfiguration {
    /** Include the standard content export and delete actions. Defaults to true when selection is enabled. */
    include_defaults?: boolean;
    /** Hide individual standard actions while keeping the remaining defaults. */
    exclude_defaults?: Array<'export' | 'delete'>;
    items?: ViewActionConfiguration[];
}

export interface ViewUploadDropParameters {
    type_id?: string;
    collection_id?: string;
    location?: string;
    properties?: JSONObject;
    allow_folders?: boolean;
}

/** A declarative result-area drop target. Stored JSON supports the built-in upload action only. */
export interface ViewDropConfiguration {
    handler: 'upload';
    accept?: Array<'files'>;
    params?: ViewUploadDropParameters;
}

export interface ViewResultsConfiguration {
    default_display: string;
    allow_display_switch?: boolean;
    displays: ViewDisplayConfiguration[];
    default_sort?: string;
    sort_options?: ViewSortOption[];
    selection?: ViewSelectionConfiguration;
    actions?: ViewActionsConfiguration;
    drop?: ViewDropConfiguration;
}

/** Navigation sources an agent may generate without resolving new external collection or location scope. */
export type AgenticViewNavigationItem = Extract<ViewNavigationItem, { source: 'terms' | 'range' | 'hierarchy' }>;

/**
 * Ephemeral, read-only presentation generated alongside an agentic query.
 * Scope, search configuration, actions, selection, and drop behavior remain
 * owned by the configured View and cannot be generated by the model.
 */
export interface AgenticViewPresentation {
    title: string;
    description?: string;
    layout?: ViewExperienceLayout;
    navigation?: AgenticViewNavigationItem[];
    display: ViewDisplayConfiguration;
    sort?: ViewSortClause[];
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

/**
 * A View configuration stored as a project resource.
 *
 * Persisted Views require documentation because they are reusable, discoverable
 * resources surfaced in Studio and to Studio Assistant.
 */
export interface PersistedViewExperienceConfiguration extends Omit<ViewExperienceConfiguration, 'description'> {
    description: string;
}

/**
 * Project a persisted or extended View value back to its reusable configuration
 * fields. Callers that require a persisted configuration must validate the
 * result at their API or persistence boundary because legacy records may not
 * satisfy newer persisted-only requirements.
 */
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

/** Project a type-valid persisted View while preserving its required documentation field. */
export function getPersistedViewExperienceConfiguration(
    value: PersistedViewExperienceConfiguration,
): PersistedViewExperienceConfiguration {
    return {
        ...getViewExperienceConfiguration(value),
        description: value.description,
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

export interface ViewExperience extends PersistedViewExperienceConfiguration {
    id: string;
    version: ViewExperienceSchemaVersion;
    revision: number;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export interface CreateViewExperienceRequest extends PersistedViewExperienceConfiguration {
    id: string;
    version?: ViewExperienceSchemaVersion;
}

/** PUT uses full replacement so omitted optional configuration is removed. */
export interface UpdateViewExperienceRequest extends PersistedViewExperienceConfiguration {
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
    /** Server-side text filters for large navigation sources, keyed by navigation id. */
    navigation_queries?: Record<string, string>;
    display?: string;
    sort?: string;
    offset?: number;
    limit?: number;
}

/**
 * Execute an unsaved (draft) View configuration without persisting it. Combines
 * the inline configuration with the same execution inputs as {@link ExecuteViewRequest}
 * so authors can validate and preview results before calling create/update.
 */
export interface PreviewViewExperienceRequest extends ExecuteViewRequest {
    /** The unsaved View configuration to validate and execute. */
    configuration: ViewExperienceConfiguration;
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

export type ViewRerankFailureCode = 'interaction_failed' | 'invalid_output' | 'timeout' | 'unknown';

export interface ViewExecutionRerankResult {
    status: 'applied' | 'fallback' | 'skipped';
    candidate_count: number;
    skip_reason?: 'not_enough_candidates' | 'query_fallback' | 'explicit_sort' | 'configured_sort';
    error_code?: ViewRerankFailureCode;
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
    /** Applied server-side node filter, when the navigation source supports it. */
    query?: string;
    /** Selected drill-down path from its root through the current value. */
    breadcrumbs?: ViewNavigationNode[];
    truncated?: boolean;
}

export interface ViewExecutionSearchResult {
    input?: string;
    interpretation?: string;
    key_terms?: Record<string, string[]>;
    plan?: ViewExecutionQueryPlan;
    rerank?: ViewExecutionRerankResult;
    requested_mode: 'browse' | 'deterministic' | 'agentic';
    applied_mode: 'browse' | 'deterministic' | 'query' | 'query_and_view';
    fallback_reason?: string;
    warnings: ViewExecutionWarning[];
}

/**
 * Client-visible search controls. Agentic planner instructions, interaction,
 * and model configuration are intentionally omitted.
 */
export interface ViewExecutionSearchConfiguration {
    renderer?: string;
    mode?: 'deterministic' | 'agentic';
    placeholder?: string;
    fields?: ViewSearchFieldDefinition[];
    key_terms?: ViewKeyTermDefinition[];
}

/**
 * The reusable, client-visible part of the View definition used for an execution.
 * Server-owned scope is intentionally omitted.
 */
export interface ViewExecutionDefinition {
    name: string;
    description?: string;
    enabled?: boolean;
    layout?: ViewExperienceLayout;
    navigation?: ViewNavigationItem[];
    search?: ViewExecutionSearchConfiguration;
    results?: ViewResultsConfiguration;
}

export interface ViewExecutionResult {
    view: string;
    revision: number;
    /** The runtime-safe rendering definition resolved by Zeno for this execution. */
    definition: ViewExecutionDefinition;
    display?: string;
    sort?: string;
    search: ViewExecutionSearchResult;
    hits: ViewHit[];
    total: number;
    navigation: Record<string, ViewNavigationResult>;
    took: number;
}
