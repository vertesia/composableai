import type { z } from 'zod';
import type {
    AgenticViewSearchConfigurationSchema,
    ExecuteViewRequestSchema,
    PreviewViewExperienceRequestSchema,
    ViewBoardCardConfigurationSchema,
    ViewBoardColumnSchema,
    ViewBoardDisplaySchema,
    ViewCardsDisplaySchema,
    ViewCollectionNavigationSchema,
    ViewDisplayConfigurationSchema,
    ViewElasticsearchQuerySchema,
    ViewExecutionDefinitionSchema,
    ViewExecutionQueryPlanSchema,
    ViewExecutionResultSchema,
    ViewExecutionSearchConfigurationSchema,
    ViewExecutionSearchResultSchema,
    ViewExecutionWarningSchema,
    ViewExperienceLayoutSchema,
    ViewExperienceScopeSchema,
    ViewGalleryDisplaySchema,
    ViewHierarchyLevelSchema,
    ViewHierarchyNavigationSchema,
    ViewHitAnnotationSchema,
    ViewHitSchema,
    ViewKeyTermDefinitionSchema,
    ViewListDisplaySchema,
    ViewLocationNavigationSchema,
    ViewNavigationItemSchema,
    ViewQueryPlanningFailureCodeSchema,
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
} from './api-schemas/zeno-remaining.js';

export const VIEW_EXPERIENCE_SCHEMA_VERSION = 1 as const;

export type ViewExperienceSchemaVersion = typeof VIEW_EXPERIENCE_SCHEMA_VERSION;

/** Build the generic reusable client route for a persisted or app-contributed View. */
export function viewExperienceRoute(id: string): string {
    return `/view/${encodeURIComponent(id)}`;
}

export type ViewElasticsearchQuery = z.infer<typeof ViewElasticsearchQuerySchema>;

export type ViewExperienceLayout = z.infer<typeof ViewExperienceLayoutSchema>;

export type ViewExperienceScope = z.infer<typeof ViewExperienceScopeSchema>;

export interface ViewNavigationBase {
    id: string;
    label: string;
    presentation?: 'tree' | 'list' | 'select' | 'chips';
    multi_select?: boolean;
    order?: number;
    renderer?: string;
}

export type ViewLocationNavigation = z.infer<typeof ViewLocationNavigationSchema>;

export type ViewCollectionNavigation = z.infer<typeof ViewCollectionNavigationSchema>;

export type ViewTermsNavigation = z.infer<typeof ViewTermsNavigationSchema>;

export type ViewHierarchyLevel = z.infer<typeof ViewHierarchyLevelSchema>;

export type ViewHierarchyNavigation = z.infer<typeof ViewHierarchyNavigationSchema>;

export type ViewRangeDefinition = z.infer<typeof ViewRangeDefinitionSchema>;

export type ViewRangeNavigation = z.infer<typeof ViewRangeNavigationSchema>;

export type ViewNavigationItem = z.infer<typeof ViewNavigationItemSchema>;

export type ViewKeyTermDefinition = z.infer<typeof ViewKeyTermDefinitionSchema>;

export const VIEW_SEARCH_FIELD_TYPES = ['text', 'keyword', 'number', 'date', 'boolean'] as const;

export type ViewSearchFieldType = z.infer<typeof ViewSearchFieldTypeSchema>;

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

export interface ViewDisplayBase {
    id: string;
    label: string;
    renderer?: string;
    page_size?: number;
}

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

// Kept as a named declaration while legacy OpenAPI components extend or map this
// type through TypeScript. ts-json-schema-generator cannot expand a z.infer alias
// through Omit/extends and would silently erase the inherited View fields.
// ViewExperienceConfigurationSchema remains the runtime authority and the parity
// test prevents the declaration from drifting while those referrers migrate.
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
