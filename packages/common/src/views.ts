import type * as Wire from './wire-types.generated.js';

export const VIEW_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ViewExperienceSchemaVersion = typeof VIEW_EXPERIENCE_SCHEMA_VERSION;

/** Build the generic reusable client route for a persisted, system, or app-contributed View. */
export function viewExperienceRoute(id: string): string {
    return `/view/${encodeURIComponent(id)}`;
}

/** An author-provided Elasticsearch query subtree validated by the View runtime. */
export type ViewElasticsearchQuery = Wire.ViewElasticsearchQuery;

export type ViewExperienceLayout = Wire.ViewExperienceLayout;

export type ViewExperienceScope = Wire.ViewExperienceScope;

export type ViewLocationNavigation = Wire.ViewLocationNavigation;

export type ViewCollectionNavigation = Wire.ViewCollectionNavigation;

export type ViewTermsNavigation = Wire.ViewTermsNavigation;

export type ViewHierarchyLevel = Wire.ViewHierarchyLevel;

/**
 * A drill-down hierarchy assembled from independently mapped properties.
 *
 * Hierarchies represent one selected path, so multi_select may only be false.
 * Selection ids are opaque runtime values and must not be constructed by clients.
 *
 * `multi_select` widens from `false` to `boolean` here, matching the published component and what
 * the endpoint has always accepted. The narrowing was an authoring hint with nothing behind it: the
 * navigation runtime takes the first selection for `source === 'hierarchy'` whatever the flag says.
 */
export type ViewHierarchyNavigation = Wire.ViewHierarchyNavigation;

export type ViewRangeDefinition = Wire.ViewRangeDefinition;

export type ViewRangeNavigation = Wire.ViewRangeNavigation;

export type ViewNavigationItem = Wire.ViewNavigationItem;

export type ViewKeyTermDefinition = Wire.ViewKeyTermDefinition;

export const VIEW_SEARCH_FIELD_TYPES = ['text', 'keyword', 'number', 'date', 'boolean'] as const;

export type ViewSearchFieldType = Wire.ViewSearchFieldType;

/**
 * A mapped Elasticsearch field that a View may use for query planning and
 * deterministic full-text fallback.
 */
export type ViewSearchFieldDefinition = Wire.ViewSearchFieldDefinition;

export const VIEW_AGENTIC_SEARCH_MODES = ['query', 'query_and_view'] as const;

export type ViewAgenticSearchMode = (typeof VIEW_AGENTIC_SEARCH_MODES)[number];

export type AgenticViewRerankConfiguration = Wire.AgenticViewRerankConfiguration;

export type ViewAgenticExecutionConfiguration = Wire.ViewAgenticExecutionConfiguration;

export type AgenticViewSearchConfiguration = Wire.AgenticViewSearchConfiguration;

export type ViewSearchConfiguration = Wire.ViewSearchConfiguration;

export type ViewSortClause = Wire.ViewSortClause;

export type ViewSortOption = Wire.ViewSortOption;

export const VIEW_RESULT_FIELD_FORMATS = [
    'text',
    'date',
    'number',
    'badge',
    'user',
    'content_type',
    'location',
] as const;

export type ViewResultFieldFormat = Wire.ViewResultFieldFormat;

export type ViewResultField = Wire.ViewResultField;

export type ViewResultMedia = Wire.ViewResultMedia;

export type ViewListDisplay = Wire.ViewListDisplay;

export type ViewTableColumn = Wire.ViewTableColumn;

export type ViewTableDisplay = Wire.ViewTableDisplay;

export type ViewCardsDisplay = Wire.ViewCardsDisplay;

export type ViewGalleryDisplay = Wire.ViewGalleryDisplay;

export type ViewBoardColumn = Wire.ViewBoardColumn;

export type ViewBoardCardConfiguration = Wire.ViewBoardCardConfiguration;

export type ViewBoardDisplay = Wire.ViewBoardDisplay;

export type ViewDisplayConfiguration = Wire.ViewDisplayConfiguration;

export type ViewResultsConfiguration = Wire.ViewResultsConfiguration;

export const VIEW_SELECTION_MODES = ['single', 'multiple'] as const;

export type ViewSelectionMode = Wire.ViewSelectionMode;

export type ViewSelectionConfiguration = Wire.ViewSelectionConfiguration;

export const VIEW_ACTION_PLACEMENTS = ['toolbar', 'row', 'selection'] as const;

export type ViewActionPlacement = Wire.ViewActionPlacement;

export const VIEW_ACTION_SELECTION_REQUIREMENTS = ['none', 'single', 'multiple', 'any'] as const;

export type ViewActionSelectionRequirement = Wire.ViewActionSelectionRequirement;

export type ViewActionConfiguration = Wire.ViewActionConfiguration;

export type ViewActionsConfiguration = Wire.ViewActionsConfiguration;

export type ViewUploadDropParameters = Wire.ViewUploadDropParameters;

export type ViewDropConfiguration = Wire.ViewDropConfiguration;

export type ViewExperienceConfiguration = Wire.ViewExperienceConfiguration;

/**
 * A View configuration stored as a project resource.
 *
 * Persisted Views require documentation because they are reusable, discoverable
 * resources surfaced in Studio and to Studio Assistant.
 */
export interface PersistedViewExperienceConfiguration extends Omit<ViewExperienceConfiguration, 'description'> {
    description: string;
}

/** A View definition contributed by application code through the app package endpoint. */
export type InCodeViewDefinition = Wire.InCodeViewDefinition;

export type ViewExperience = Wire.ViewExperience;

export type CreateViewExperienceRequest = Wire.CreateViewExperienceRequest;

/** PUT uses full replacement so omitted optional configuration is removed. */
export type UpdateViewExperienceRequest = Wire.UpdateViewExperienceRequest;

export type ViewExperienceListQuery = Wire.ViewExperienceListQuery;

export type ExecuteViewRequest = Wire.ExecuteViewRequest;

export type PreviewViewExperienceRequest = Wire.PreviewViewExperienceRequest;

export type ViewExecutionWarning = Wire.ViewExecutionWarning;

export type ViewQueryPlanningFailureCode = Wire.ViewQueryPlanningFailureCode;

export type ViewExecutionQueryPlan = Wire.ViewExecutionQueryPlan;

export type ViewRerankFailureCode = Wire.ViewRerankFailureCode;

export type ViewExecutionRerankResult = Wire.ViewExecutionRerankResult;

export type ViewHitAnnotation = Wire.ViewHitAnnotation;

export type ViewHit = Wire.ViewHit;

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

export type ViewExecutionSearchResult = Wire.ViewExecutionSearchResult;

export type ViewExecutionSearchConfiguration = Wire.ViewExecutionSearchConfiguration;

export type ViewExecutionDefinition = Wire.ViewExecutionDefinition;

export type ViewExecutionResult = Wire.ViewExecutionResult;
