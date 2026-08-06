import type { z } from 'zod';
import type { InCodeViewDefinitionSchema } from './api-schemas/app-runtime.js';
import type {
    ExecuteViewRequestSchema,
    PreviewViewExperienceRequestSchema,
    ViewExecutionDefinitionSchema,
    ViewExecutionQueryPlanSchema,
    ViewExecutionResultSchema,
    ViewExecutionSearchConfigurationSchema,
    ViewExecutionSearchResultSchema,
    ViewExecutionWarningSchema,
    ViewExperienceConfigurationSchema,
    ViewHitAnnotationSchema,
    ViewHitSchema,
    ViewQueryPlanningFailureCodeSchema,
} from './api-schemas/view-execution.js';
import type {
    AgenticViewSearchConfigurationSchema,
    CreateViewExperienceRequestSchema,
    UpdateViewExperienceRequestSchema,
    ViewBoardCardConfigurationSchema,
    ViewBoardColumnSchema,
    ViewBoardDisplaySchema,
    ViewCardsDisplaySchema,
    ViewCollectionNavigationSchema,
    ViewDisplayConfigurationSchema,
    ViewElasticsearchQuerySchema,
    ViewExperienceLayoutSchema,
    ViewExperienceListQuerySchema,
    ViewExperienceSchema,
    ViewExperienceScopeSchema,
    ViewGalleryDisplaySchema,
    ViewHierarchyLevelSchema,
    ViewHierarchyNavigationSchema,
    ViewKeyTermDefinitionSchema,
    ViewListDisplaySchema,
    ViewLocationNavigationSchema,
    ViewNavigationItemSchema,
    ViewRangeDefinitionSchema,
    ViewRangeNavigationSchema,
    ViewResultFieldFormatSchema,
    ViewResultFieldSchema,
    ViewResultMediaSchema,
    ViewResultsConfigurationSchema,
    ViewSearchConfigurationSchema,
    ViewSearchFieldDefinitionSchema,
    ViewSearchFieldTypeSchema,
    ViewSortClauseSchema,
    ViewSortOptionSchema,
    ViewTableColumnSchema,
    ViewTableDisplaySchema,
    ViewTermsNavigationSchema,
} from './api-schemas/views.js';

export const VIEW_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ViewExperienceSchemaVersion = typeof VIEW_EXPERIENCE_SCHEMA_VERSION;

/** Build the generic reusable client route for a persisted or app-contributed View. */
export function viewExperienceRoute(id: string): string {
    return `/view/${encodeURIComponent(id)}`;
}

/** An author-provided Elasticsearch query subtree validated by the View runtime. */
export type ViewElasticsearchQuery = z.infer<typeof ViewElasticsearchQuerySchema>;

export type ViewExperienceLayout = z.infer<typeof ViewExperienceLayoutSchema>;

export type ViewExperienceScope = z.infer<typeof ViewExperienceScopeSchema>;

export type ViewLocationNavigation = z.infer<typeof ViewLocationNavigationSchema>;

export type ViewCollectionNavigation = z.infer<typeof ViewCollectionNavigationSchema>;

export type ViewTermsNavigation = z.infer<typeof ViewTermsNavigationSchema>;

export type ViewHierarchyLevel = z.infer<typeof ViewHierarchyLevelSchema>;

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
export type ViewHierarchyNavigation = z.infer<typeof ViewHierarchyNavigationSchema>;

export type ViewRangeDefinition = z.infer<typeof ViewRangeDefinitionSchema>;

export type ViewRangeNavigation = z.infer<typeof ViewRangeNavigationSchema>;

export type ViewNavigationItem = z.infer<typeof ViewNavigationItemSchema>;

export type ViewKeyTermDefinition = z.infer<typeof ViewKeyTermDefinitionSchema>;

export const VIEW_SEARCH_FIELD_TYPES = ['text', 'keyword', 'number', 'date', 'boolean'] as const;

export type ViewSearchFieldType = z.infer<typeof ViewSearchFieldTypeSchema>;

/**
 * A mapped Elasticsearch field that a View may use for query planning and
 * deterministic full-text fallback.
 */
export type ViewSearchFieldDefinition = z.infer<typeof ViewSearchFieldDefinitionSchema>;

export type AgenticViewSearchConfiguration = z.infer<typeof AgenticViewSearchConfigurationSchema>;

export type ViewSearchConfiguration = z.infer<typeof ViewSearchConfigurationSchema>;

export type ViewSortClause = z.infer<typeof ViewSortClauseSchema>;

export type ViewSortOption = z.infer<typeof ViewSortOptionSchema>;

export const VIEW_RESULT_FIELD_FORMATS = [
    'text',
    'date',
    'number',
    'badge',
    'user',
    'content_type',
    'location',
] as const;

export type ViewResultFieldFormat = z.infer<typeof ViewResultFieldFormatSchema>;

export type ViewResultField = z.infer<typeof ViewResultFieldSchema>;

export type ViewResultMedia = z.infer<typeof ViewResultMediaSchema>;

export type ViewListDisplay = z.infer<typeof ViewListDisplaySchema>;

export type ViewTableColumn = z.infer<typeof ViewTableColumnSchema>;

export type ViewTableDisplay = z.infer<typeof ViewTableDisplaySchema>;

export type ViewCardsDisplay = z.infer<typeof ViewCardsDisplaySchema>;

export type ViewGalleryDisplay = z.infer<typeof ViewGalleryDisplaySchema>;

export type ViewBoardColumn = z.infer<typeof ViewBoardColumnSchema>;

export type ViewBoardCardConfiguration = z.infer<typeof ViewBoardCardConfigurationSchema>;

export type ViewBoardDisplay = z.infer<typeof ViewBoardDisplaySchema>;

export type ViewDisplayConfiguration = z.infer<typeof ViewDisplayConfigurationSchema>;

export type ViewResultsConfiguration = z.infer<typeof ViewResultsConfigurationSchema>;

export type ViewExperienceConfiguration = z.infer<typeof ViewExperienceConfigurationSchema>;

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
function getViewExperienceConfiguration(value: ViewExperienceConfiguration): ViewExperienceConfiguration {
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
export type InCodeViewDefinition = z.infer<typeof InCodeViewDefinitionSchema>;

export type ViewExperience = z.infer<typeof ViewExperienceSchema>;

export type CreateViewExperienceRequest = z.infer<typeof CreateViewExperienceRequestSchema>;

/** PUT uses full replacement so omitted optional configuration is removed. */
export type UpdateViewExperienceRequest = z.infer<typeof UpdateViewExperienceRequestSchema>;

export type ViewExperienceListQuery = z.infer<typeof ViewExperienceListQuerySchema>;

export type ExecuteViewRequest = z.infer<typeof ExecuteViewRequestSchema>;

export type PreviewViewExperienceRequest = z.infer<typeof PreviewViewExperienceRequestSchema>;

export type ViewExecutionWarning = z.infer<typeof ViewExecutionWarningSchema>;

export type ViewQueryPlanningFailureCode = z.infer<typeof ViewQueryPlanningFailureCodeSchema>;

export type ViewExecutionQueryPlan = z.infer<typeof ViewExecutionQueryPlanSchema>;

export type ViewHitAnnotation = z.infer<typeof ViewHitAnnotationSchema>;

export type ViewHit = z.infer<typeof ViewHitSchema>;

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
    /** Selected hierarchy path from its root through the current value. */
    breadcrumbs?: ViewNavigationNode[];
    truncated?: boolean;
}

export type ViewExecutionSearchResult = z.infer<typeof ViewExecutionSearchResultSchema>;

export type ViewExecutionSearchConfiguration = z.infer<typeof ViewExecutionSearchConfigurationSchema>;

export type ViewExecutionDefinition = z.infer<typeof ViewExecutionDefinitionSchema>;

export type ViewExecutionResult = z.infer<typeof ViewExecutionResultSchema>;
