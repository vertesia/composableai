import { z } from 'zod';
import { VIEW_EXPERIENCE_SCHEMA_VERSION, VIEW_RESULT_FIELD_FORMATS, VIEW_SEARCH_FIELD_TYPES } from '../views.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

// The view experiences a project publishes: the search, navigation, results and display
// configuration a curated content view is assembled from, and the create/update payloads for them.
//
// `//` rather than `/** */` throughout: a JSDoc block immediately preceding an exported declaration
// is picked up by the OpenAPI scanner and published as that component's `description`, which would
// double up with the `description` stated in `.meta()`.

// The version literal and the two field vocabularies read their members off the declarations in
// `../views.js` rather than restating them: those are what the View runtime and its validator
// iterate, so a format added there reaches the document with nothing here changing.
export const ViewExperienceSchemaVersionSchema = z
    .literal(VIEW_EXPERIENCE_SCHEMA_VERSION)
    .meta({ id: 'ViewExperienceSchemaVersion' });

export const ViewSortClauseSchema = z
    .strictObject({
        field: z.string(),
        order: z.enum(['asc', 'desc']),
    })
    .meta({ id: 'ViewSortClause' });

export const ViewResultMediaSchema = z
    .strictObject({
        source: z.enum(['content_thumbnail', 'property', 'type_icon']),
        field: z.string().optional(),
        fit: z.enum(['cover', 'contain']).optional(),
        fallback: z.enum(['type_icon', 'placeholder', 'none']).optional(),
    })
    .meta({ id: 'ViewResultMedia' });

export const ViewResultFieldFormatSchema = z.enum(VIEW_RESULT_FIELD_FORMATS).meta({ id: 'ViewResultFieldFormat' });

export const ViewBoardColumnSchema = z
    .strictObject({
        value: z.string(),
        label: z.string(),
        order: z.number().optional(),
    })
    .meta({ id: 'ViewBoardColumn' });

export const ViewTableColumnSchema = z
    .strictObject({
        field: z.string(),
        label: z.string().optional(),
        format: ViewResultFieldFormatSchema.optional(),
        fallback: z.string().optional(),
        width: z.number().optional(),
        sortable: z.boolean().optional(),
        sort_option: z.string().optional(),
    })
    .meta({ id: 'ViewTableColumn' });

export const AgenticViewSearchConfigurationSchema = z
    .strictObject({
        interaction: z.string().optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        instructions: z
            .string()
            .meta({ description: 'View-specific guidance for Elasticsearch query planning.' })
            .optional(),
        mode: z.literal('query').optional(),
        timeout_ms: z.number().optional(),
        minimum_confidence: z.number().optional(),
    })
    .meta({ id: 'AgenticViewSearchConfiguration' });

export const ViewSearchFieldTypeSchema = z.enum(VIEW_SEARCH_FIELD_TYPES).meta({ id: 'ViewSearchFieldType' });

export const ViewSearchFieldDefinitionSchema = z
    .strictObject({
        field: z.string(),
        description: z
            .string()
            .meta({ description: 'Meaning of the field for query planners, for example "Full OCR text".' })
            .optional(),
        type: ViewSearchFieldTypeSchema.meta({
            description: 'Mapping hint used only when the active index mapping does not expose a type.',
        }).optional(),
        mode: z
            .enum(['auto', 'full_text', 'exact'])
            .meta({
                description:
                    '`full_text` enables scoring text queries, `exact` limits the field to structured operators, and `auto` derives behavior from the mapped type.',
            })
            .optional(),
        boost: z
            .number()
            .meta({ description: 'Relative boost when this field participates in multi-field text search.' })
            .optional(),
    })
    .meta({
        id: 'ViewSearchFieldDefinition',
        description:
            'A mapped Elasticsearch field that a View may use for query planning and deterministic full-text fallback.',
    });

export const ViewRangeDefinitionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        from: z.number().optional(),
        to: z.number().optional(),
    })
    .meta({ id: 'ViewRangeDefinition' });

export const ViewHierarchyLevelSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        field: z.string(),
        size: z.number().optional(),
        sort: z.enum(['count', 'label']).optional(),
    })
    .meta({ id: 'ViewHierarchyLevel' });

export const ViewTermsNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('terms'),
        field: z.string(),
        size: z.number().optional(),
        sort: z.enum(['count', 'label']).optional(),
    })
    .meta({ id: 'ViewTermsNavigation' });

export const ViewCollectionNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('collection'),
        roots: z.array(z.string()).optional(),
        include_descendants: z.boolean().optional(),
    })
    .meta({ id: 'ViewCollectionNavigation' });

export const ViewLocationNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('location'),
        roots: z.array(z.string()).optional(),
        depth: z.number().optional(),
    })
    .meta({ id: 'ViewLocationNavigation' });

export const ViewElasticsearchQuerySchema = z.object({}).catchall(z.unknown()).meta({
    id: 'ViewElasticsearchQuery',
    description: 'An author-provided Elasticsearch query subtree validated by the View runtime.',
});

export const ViewExperienceLayoutSchema = z
    .strictObject({
        mode: z.enum(['browse', 'worklist']).optional(),
        navigation_position: z.enum(['sidebar', 'top']).optional(),
    })
    .meta({ id: 'ViewExperienceLayout' });

export const ViewSortOptionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        sort: z.array(ViewSortClauseSchema),
    })
    .meta({ id: 'ViewSortOption' });

export const ViewResultFieldSchema = z
    .strictObject({
        field: z.string(),
        label: z.string().optional(),
        format: ViewResultFieldFormatSchema.optional(),
        fallback: z.string().optional(),
    })
    .meta({ id: 'ViewResultField' });

export const ViewTableDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('table'),
        columns: z.array(ViewTableColumnSchema),
    })
    .meta({ id: 'ViewTableDisplay' });

export const ViewListDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('list'),
        title: ViewResultFieldSchema,
        subtitle: z.array(ViewResultFieldSchema).optional(),
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
    })
    .meta({ id: 'ViewListDisplay' });

export const ViewKeyTermDefinitionSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        field: z.string().optional(),
        type: ViewSearchFieldTypeSchema,
        multiple: z.boolean().optional(),
        operator: z.enum(['match', 'term', 'range']).optional(),
    })
    .meta({ id: 'ViewKeyTermDefinition' });

export const ViewRangeNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('range'),
        field: z.string(),
        ranges: z.array(ViewRangeDefinitionSchema),
    })
    .meta({ id: 'ViewRangeNavigation' });

export const ViewHierarchyNavigationSchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        presentation: z.enum(['tree', 'list', 'select', 'chips']).optional(),
        multi_select: z.boolean().optional(),
        order: z.number().optional(),
        renderer: z.string().optional(),
        source: z.literal('hierarchy'),
        levels: z.array(ViewHierarchyLevelSchema),
    })
    .meta({
        id: 'ViewHierarchyNavigation',
        description:
            'A drill-down hierarchy assembled from independently mapped properties.\n\nHierarchies represent one selected path, so multi_select may only be false. Selection ids are opaque runtime values and must not be constructed by clients.',
    });

export const ViewExperienceScopeSchema = z
    .strictObject({
        type_ids: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        collection_ids: z.array(z.string()).optional(),
        include_collection_descendants: z.boolean().optional(),
        fixed_filter: ViewElasticsearchQuerySchema.optional(),
        head_only: z.boolean().optional(),
    })
    .meta({ id: 'ViewExperienceScope' });

export const ViewBoardCardConfigurationSchema = z
    .strictObject({
        title: ViewResultFieldSchema,
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        fields: z.array(ViewResultFieldSchema).optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
    })
    .meta({ id: 'ViewBoardCardConfiguration' });

export const ViewSearchConfigurationSchema = z
    .strictObject({
        renderer: z.string().optional(),
        mode: z.enum(['deterministic', 'agentic']).optional(),
        placeholder: z.string().optional(),
        fields: z.array(ViewSearchFieldDefinitionSchema).optional(),
        key_terms: z.array(ViewKeyTermDefinitionSchema).optional(),
        agentic: AgenticViewSearchConfigurationSchema.optional(),
    })
    .meta({ id: 'ViewSearchConfiguration' });

export const ViewNavigationItemSchema = z
    .discriminatedUnion('source', [
        ViewLocationNavigationSchema,
        ViewCollectionNavigationSchema,
        ViewTermsNavigationSchema,
        ViewHierarchyNavigationSchema,
        ViewRangeNavigationSchema,
    ])
    .meta({ id: 'ViewNavigationItem', type: 'object' });

export const ViewBoardDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('board'),
        group_by: z.string(),
        columns: z.array(ViewBoardColumnSchema).optional(),
        card: ViewBoardCardConfigurationSchema,
    })
    .meta({ id: 'ViewBoardDisplay' });

// Both display contracts carry `columns` as a numeric enum. `z.literal([...])` emits `type: number`
// with the same `enum` list the document already publishes — a `z.union` of literals would emit
// `anyOf`, and a plain `z.number()` would drop the constraint.
const VIEW_DISPLAY_COLUMNS = z.literal([2, 3, 4, 5, 6]).optional();

export const ViewCardsDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('cards'),
        title: ViewResultFieldSchema,
        description: ViewResultFieldSchema.optional(),
        media: ViewResultMediaSchema.optional(),
        fields: z.array(ViewResultFieldSchema).optional(),
        badges: z.array(ViewResultFieldSchema).optional(),
        columns: VIEW_DISPLAY_COLUMNS,
    })
    .meta({ id: 'ViewCardsDisplay' });

export const ViewGalleryDisplaySchema = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        renderer: z.string().optional(),
        page_size: z.number().optional(),
        type: z.literal('gallery'),
        media: ViewResultMediaSchema,
        title: ViewResultFieldSchema,
        caption: z.array(ViewResultFieldSchema).optional(),
        columns: VIEW_DISPLAY_COLUMNS,
    })
    .meta({ id: 'ViewGalleryDisplay' });

export const ViewDisplayConfigurationSchema = z
    .discriminatedUnion('type', [
        ViewListDisplaySchema,
        ViewTableDisplaySchema,
        ViewCardsDisplaySchema,
        ViewGalleryDisplaySchema,
        ViewBoardDisplaySchema,
    ])
    .meta({ id: 'ViewDisplayConfiguration', type: 'object' });

export const ViewResultsConfigurationSchema = z
    .strictObject({
        default_display: z.string(),
        allow_display_switch: z.boolean().optional(),
        displays: z.array(ViewDisplayConfigurationSchema),
        default_sort: z.string().optional(),
        sort_options: z.array(ViewSortOptionSchema).optional(),
    })
    .meta({ id: 'ViewResultsConfiguration' });

export const CreateViewExperienceRequestSchema = z
    .strictObject({
        name: z.string(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        scope: ViewExperienceScopeSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
        description: z.string(),
        id: z.string(),
        version: ViewExperienceSchemaVersionSchema.optional(),
    })
    .meta({ id: 'CreateViewExperienceRequest' });

export const ViewExperienceSchema = z
    .strictObject({
        name: z.string(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        scope: ViewExperienceScopeSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
        description: z.string(),
        id: z.string(),
        version: ViewExperienceSchemaVersionSchema,
        revision: z.number(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'ViewExperience' });

export const UpdateViewExperienceRequestSchema = z
    .strictObject({
        name: z.string(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        scope: ViewExperienceScopeSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
        description: z.string(),
        version: ViewExperienceSchemaVersionSchema,
        revision: z.number(),
    })
    .meta({
        id: 'UpdateViewExperienceRequest',
        description: 'PUT uses full replacement so omitted optional configuration is removed.',
    });

export const ViewExperienceArraySchema = z.array(ViewExperienceSchema).meta({ id: 'ViewExperienceArray' });

// Query contracts are registry components even though the scanner expands them into parameters.
export const ViewExperienceListQuerySchema = z
    .strictObject({
        limit: z
            .number()
            .meta({ description: 'Page size. Clamped to 1..100; anything unparseable falls back to 50.' })
            .optional(),
        offset: z
            .number()
            .meta({ description: 'Number of Views to skip. Negative values are clamped to 0.' })
            .optional(),
    })
    .meta({ id: 'ViewExperienceListQuery' });
