import type { JSONSchema } from './json-schema.js';
import {
    ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE,
    VIEW_CONFIGURATION_ID_PATTERN_SOURCE,
} from './view-validation-helpers.js';
import { VIEW_RESULT_FIELD_FORMATS, VIEW_SEARCH_FIELD_TYPES } from './views.js';

export const VIEW_EXPERIENCE_CONFIGURATION_JSON_SCHEMA_ID =
    'https://schemas.vertesia.com/view-experience.v1.schema.json';
export const PERSISTED_VIEW_EXPERIENCE_CONFIGURATION_JSON_SCHEMA_ID =
    'https://schemas.vertesia.com/persisted-view-experience.v1.schema.json';

/**
 * Canonical structural schema for reusable inline and app-contributed View configuration.
 *
 * Cross-reference rules such as unique navigation ids and valid default display
 * references are enforced by validateViewConfiguration().
 */
export const ViewExperienceConfigurationJsonSchema = {
    $id: VIEW_EXPERIENCE_CONFIGURATION_JSON_SCHEMA_ID,
    type: 'object',
    title: 'View Experience',
    description:
        'A reusable content navigation and search experience. Save it through /api/v1/views, then render it at /view/<id>.',
    properties: {
        name: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
            description: 'Human-readable View name.',
        },
        description: {
            type: 'string',
            maxLength: 4000,
            description: 'Purpose and intended audience of this View.',
        },
        enabled: {
            type: 'boolean',
            description: 'Whether the View may be executed.',
        },
        layout: {
            $ref: '#/$defs/layout',
        },
        scope: {
            $ref: '#/$defs/scope',
        },
        navigation: {
            type: 'array',
            maxItems: 20,
            description: 'Ordered facets or hierarchies used to browse the scoped content.',
            items: {
                oneOf: [
                    { $ref: '#/$defs/locationNavigation' },
                    { $ref: '#/$defs/collectionNavigation' },
                    { $ref: '#/$defs/termsNavigation' },
                    { $ref: '#/$defs/hierarchyNavigation' },
                    { $ref: '#/$defs/rangeNavigation' },
                ],
            },
        },
        search: {
            $ref: '#/$defs/search',
        },
        results: {
            $ref: '#/$defs/results',
        },
    },
    required: ['name'],
    additionalProperties: false,
    $defs: {
        configurationId: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            pattern: VIEW_CONFIGURATION_ID_PATTERN_SOURCE,
            description: 'Stable id starting with a letter and containing letters, numbers, underscores, or hyphens.',
        },
        fieldName: {
            type: 'string',
            minLength: 1,
            maxLength: 160,
            pattern: ELASTICSEARCH_FIELD_PATH_PATTERN_SOURCE,
            description: 'Dot-separated Elasticsearch field name.',
        },
        stringArray: {
            type: 'array',
            maxItems: 100,
            items: {
                type: 'string',
                minLength: 1,
            },
        },
        layout: {
            type: 'object',
            description: 'Overall browsing layout.',
            properties: {
                mode: {
                    type: 'string',
                    enum: ['browse', 'worklist'],
                    description: 'Browse emphasizes discovery; worklist emphasizes case-style task handling.',
                },
                navigation_position: {
                    type: 'string',
                    enum: ['sidebar', 'top'],
                    description: 'Where navigation widgets appear.',
                },
            },
            required: [],
            additionalProperties: false,
        },
        scope: {
            type: 'object',
            description: 'Hard boundary applied to every search and navigation query.',
            properties: {
                type_ids: {
                    $ref: '#/$defs/stringArray',
                    description: 'Content type ids included in the View.',
                },
                locations: {
                    $ref: '#/$defs/stringArray',
                    description: 'Absolute content location roots included in the View.',
                },
                collection_ids: {
                    $ref: '#/$defs/stringArray',
                    description: 'Collection ids included in the View.',
                },
                include_collection_descendants: {
                    type: 'boolean',
                    description: 'Include descendants of scoped collections.',
                },
                fixed_filter: {
                    type: 'object',
                    description:
                        'Elasticsearch query clause always applied by the runtime. Script-like and unsafe clauses are rejected.',
                    required: [],
                    additionalProperties: true,
                },
                head_only: {
                    type: 'boolean',
                    description: 'Return only current head revisions.',
                },
            },
            required: [],
            additionalProperties: false,
        },
        locationNavigation: {
            type: 'object',
            title: 'Location hierarchy',
            description: 'Browse the hierarchical content location path.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                source: { const: 'location' },
                presentation: { type: 'string', enum: ['tree', 'list', 'select', 'chips'] },
                multi_select: { type: 'boolean' },
                order: { type: 'integer' },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                roots: {
                    type: 'array',
                    maxItems: 50,
                    items: { type: 'string', pattern: '^/' },
                    description: 'Absolute location roots shown by the hierarchy.',
                },
                depth: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 20,
                },
            },
            required: ['id', 'label', 'source'],
            additionalProperties: false,
        },
        collectionNavigation: {
            type: 'object',
            title: 'Collection hierarchy',
            description: 'Browse collection membership and optionally collection descendants.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                source: { const: 'collection' },
                presentation: { type: 'string', enum: ['tree', 'list', 'select', 'chips'] },
                multi_select: { type: 'boolean' },
                order: { type: 'integer' },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                roots: {
                    type: 'array',
                    maxItems: 50,
                    items: { type: 'string', minLength: 1 },
                },
                include_descendants: {
                    type: 'boolean',
                },
            },
            required: ['id', 'label', 'source'],
            additionalProperties: false,
        },
        termsNavigation: {
            type: 'object',
            title: 'Property facet',
            description: 'Bucket a keyword-like property such as brand.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                source: { const: 'terms' },
                presentation: { type: 'string', enum: ['tree', 'list', 'select', 'chips'] },
                multi_select: { type: 'boolean' },
                order: { type: 'integer' },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                field: { $ref: '#/$defs/fieldName' },
                size: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 500,
                },
                sort: {
                    type: 'string',
                    enum: ['count', 'label'],
                },
            },
            required: ['id', 'label', 'source', 'field'],
            additionalProperties: false,
        },
        hierarchyLevel: {
            type: 'object',
            title: 'Property hierarchy level',
            description: 'One mapped property in a drill-down hierarchy.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                field: { $ref: '#/$defs/fieldName' },
                size: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 500,
                },
                sort: {
                    type: 'string',
                    enum: ['count', 'label'],
                },
            },
            required: ['id', 'label', 'field'],
            additionalProperties: false,
        },
        hierarchyNavigation: {
            type: 'object',
            title: 'Property hierarchy',
            description: 'Drill down through mapped properties such as State, then City.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                source: { const: 'hierarchy' },
                presentation: { type: 'string', enum: ['tree', 'list', 'select', 'chips'] },
                multi_select: { const: false },
                order: { type: 'integer' },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                levels: {
                    type: 'array',
                    minItems: 2,
                    maxItems: 10,
                    items: { $ref: '#/$defs/hierarchyLevel' },
                },
            },
            required: ['id', 'label', 'source', 'levels'],
            additionalProperties: false,
        },
        rangeDefinition: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                from: { type: 'number' },
                to: { type: 'number' },
            },
            required: ['id', 'label'],
            additionalProperties: false,
            anyOf: [{ required: ['from'] }, { required: ['to'] }],
        },
        rangeNavigation: {
            type: 'object',
            title: 'Numeric range facet',
            description: 'Bucket a numeric property such as project_size into authored ranges.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                source: { const: 'range' },
                presentation: { type: 'string', enum: ['tree', 'list', 'select', 'chips'] },
                multi_select: { type: 'boolean' },
                order: { type: 'integer' },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                field: { $ref: '#/$defs/fieldName' },
                ranges: {
                    type: 'array',
                    minItems: 1,
                    items: { $ref: '#/$defs/rangeDefinition' },
                },
            },
            required: ['id', 'label', 'source', 'field', 'ranges'],
            additionalProperties: false,
        },
        keyTerm: {
            type: 'object',
            description: 'A URL-serializable structured search input.',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                field: { $ref: '#/$defs/fieldName' },
                type: {
                    type: 'string',
                    enum: [...VIEW_SEARCH_FIELD_TYPES],
                },
                multiple: { type: 'boolean' },
                operator: {
                    type: 'string',
                    enum: ['match', 'term', 'range'],
                },
            },
            required: ['id', 'label', 'type'],
            additionalProperties: false,
        },
        searchField: {
            type: 'object',
            description:
                'A mapped Elasticsearch field available to query planning and deterministic full-text fallback.',
            properties: {
                field: { $ref: '#/$defs/fieldName' },
                description: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 500,
                    description: 'Semantic meaning of the field for query planners.',
                },
                type: {
                    type: 'string',
                    enum: [...VIEW_SEARCH_FIELD_TYPES],
                    description: 'Mapping hint used only when the active index does not expose the field type.',
                },
                mode: {
                    type: 'string',
                    enum: ['auto', 'full_text', 'exact'],
                    description:
                        'Whether the field supports scoring text queries, structured exact queries, or mapping-derived behavior.',
                },
                boost: {
                    type: 'number',
                    minimum: 0.1,
                    maximum: 20,
                    description: 'Relative boost when the field participates in multi-field text search.',
                },
            },
            required: ['field'],
            additionalProperties: false,
        },
        interactionConfig: {
            type: 'object',
            description:
                'One execution configuration for the agentic search model. Set environment and/or model to override project defaults.',
            properties: {
                id: { type: 'string' },
                environment: { type: 'string' },
                model: { type: 'string' },
                do_validate: { type: 'boolean' },
                run_data: { type: 'string' },
                configMode: { type: 'string' },
                model_options: {
                    type: 'object',
                    required: [],
                    additionalProperties: true,
                },
                prompt_cache_key: { type: 'string' },
                prompt_cache_schema_suffix: { type: 'boolean' },
                http_timeout: {
                    type: 'object',
                    required: [],
                    additionalProperties: true,
                },
            },
            required: [],
            additionalProperties: true,
        },
        agenticSearch: {
            type: 'object',
            description:
                'Agentic query planning configuration. The default interaction is sys:ContentSearchAgent and it emits secured Elasticsearch DSL.',
            properties: {
                interaction: {
                    type: 'string',
                    maxLength: 200,
                    description: 'Interaction id. Defaults to sys:ContentSearchAgent.',
                },
                config: { $ref: '#/$defs/interactionConfig' },
                instructions: {
                    type: 'string',
                    maxLength: 4000,
                    description: 'Domain-specific guidance for translating natural language into Elasticsearch DSL.',
                },
                mode: {
                    type: 'string',
                    enum: ['query'],
                    description: 'Generate and validate an Elasticsearch query before execution.',
                },
                timeout_ms: {
                    type: 'integer',
                    minimum: 1000,
                    maximum: 60000,
                },
                minimum_confidence: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                },
            },
            required: [],
            additionalProperties: false,
        },
        search: {
            type: 'object',
            description: 'Text and structured search configuration.',
            properties: {
                renderer: {
                    type: 'string',
                    maxLength: 120,
                    description: 'Optional app-registered search renderer name.',
                },
                mode: {
                    type: 'string',
                    enum: ['deterministic', 'agentic'],
                },
                placeholder: {
                    type: 'string',
                    maxLength: 240,
                },
                fields: {
                    type: 'array',
                    maxItems: 50,
                    items: { $ref: '#/$defs/searchField' },
                    description:
                        'Fields disclosed to query planning. Text-capable entries also define deterministic fallback search.',
                },
                key_terms: {
                    type: 'array',
                    maxItems: 50,
                    items: { $ref: '#/$defs/keyTerm' },
                },
                agentic: { $ref: '#/$defs/agenticSearch' },
            },
            required: [],
            additionalProperties: false,
        },
        resultField: {
            type: 'object',
            properties: {
                field: { $ref: '#/$defs/fieldName' },
                label: { type: 'string', maxLength: 120 },
                format: {
                    type: 'string',
                    enum: [...VIEW_RESULT_FIELD_FORMATS],
                },
                fallback: { type: 'string', maxLength: 240 },
            },
            required: ['field'],
            additionalProperties: false,
        },
        resultMedia: {
            type: 'object',
            properties: {
                source: {
                    type: 'string',
                    enum: ['content_thumbnail', 'property', 'type_icon'],
                },
                field: { $ref: '#/$defs/fieldName' },
                fit: {
                    type: 'string',
                    enum: ['cover', 'contain'],
                },
                fallback: {
                    type: 'string',
                    enum: ['type_icon', 'placeholder', 'none'],
                },
            },
            required: ['source'],
            additionalProperties: false,
        },
        resultFieldArray: {
            type: 'array',
            items: { $ref: '#/$defs/resultField' },
        },
        listDisplay: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                type: { const: 'list' },
                title: { $ref: '#/$defs/resultField' },
                subtitle: { $ref: '#/$defs/resultFieldArray' },
                description: { $ref: '#/$defs/resultField' },
                media: { $ref: '#/$defs/resultMedia' },
                badges: { $ref: '#/$defs/resultFieldArray' },
            },
            required: ['id', 'label', 'type', 'title'],
            additionalProperties: false,
        },
        tableColumn: {
            type: 'object',
            properties: {
                field: { $ref: '#/$defs/fieldName' },
                label: { type: 'string', maxLength: 120 },
                format: {
                    type: 'string',
                    enum: [...VIEW_RESULT_FIELD_FORMATS],
                },
                fallback: { type: 'string', maxLength: 240 },
                width: { type: 'integer', minimum: 40, maximum: 2000 },
                sortable: { type: 'boolean' },
                sort_option: { $ref: '#/$defs/configurationId' },
            },
            required: ['field'],
            additionalProperties: false,
        },
        tableDisplay: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                type: { const: 'table' },
                columns: {
                    type: 'array',
                    minItems: 1,
                    items: { $ref: '#/$defs/tableColumn' },
                },
            },
            required: ['id', 'label', 'type', 'columns'],
            additionalProperties: false,
        },
        cardsDisplay: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                type: { const: 'cards' },
                title: { $ref: '#/$defs/resultField' },
                description: { $ref: '#/$defs/resultField' },
                media: { $ref: '#/$defs/resultMedia' },
                fields: { $ref: '#/$defs/resultFieldArray' },
                badges: { $ref: '#/$defs/resultFieldArray' },
                columns: { type: 'integer', enum: [2, 3, 4, 5, 6] },
            },
            required: ['id', 'label', 'type', 'title'],
            additionalProperties: false,
        },
        galleryDisplay: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                type: { const: 'gallery' },
                media: { $ref: '#/$defs/resultMedia' },
                title: { $ref: '#/$defs/resultField' },
                caption: { $ref: '#/$defs/resultFieldArray' },
                columns: { type: 'integer', enum: [2, 3, 4, 5, 6] },
            },
            required: ['id', 'label', 'type', 'media', 'title'],
            additionalProperties: false,
        },
        boardCard: {
            type: 'object',
            properties: {
                title: { $ref: '#/$defs/resultField' },
                description: { $ref: '#/$defs/resultField' },
                media: { $ref: '#/$defs/resultMedia' },
                fields: { $ref: '#/$defs/resultFieldArray' },
                badges: { $ref: '#/$defs/resultFieldArray' },
            },
            required: ['title'],
            additionalProperties: false,
        },
        boardColumn: {
            type: 'object',
            properties: {
                value: { type: 'string', minLength: 1 },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                order: { type: 'integer' },
            },
            required: ['value', 'label'],
            additionalProperties: false,
        },
        boardDisplay: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                renderer: { type: 'string', minLength: 1, maxLength: 120 },
                page_size: { type: 'integer', minimum: 1, maximum: 200 },
                type: { const: 'board' },
                group_by: { $ref: '#/$defs/fieldName' },
                columns: {
                    type: 'array',
                    items: { $ref: '#/$defs/boardColumn' },
                },
                card: { $ref: '#/$defs/boardCard' },
            },
            required: ['id', 'label', 'type', 'group_by', 'card'],
            additionalProperties: false,
        },
        display: {
            oneOf: [
                { $ref: '#/$defs/listDisplay' },
                { $ref: '#/$defs/tableDisplay' },
                { $ref: '#/$defs/cardsDisplay' },
                { $ref: '#/$defs/galleryDisplay' },
                { $ref: '#/$defs/boardDisplay' },
            ],
        },
        sortClause: {
            type: 'object',
            properties: {
                field: { $ref: '#/$defs/fieldName' },
                order: {
                    type: 'string',
                    enum: ['asc', 'desc'],
                },
            },
            required: ['field', 'order'],
            additionalProperties: false,
        },
        sortOption: {
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/configurationId' },
                label: { type: 'string', minLength: 1, maxLength: 120 },
                sort: {
                    type: 'array',
                    minItems: 1,
                    items: { $ref: '#/$defs/sortClause' },
                },
            },
            required: ['id', 'label', 'sort'],
            additionalProperties: false,
        },
        results: {
            type: 'object',
            description: 'Built-in or app-rendered visual result layouts.',
            properties: {
                default_display: { $ref: '#/$defs/configurationId' },
                allow_display_switch: { type: 'boolean' },
                displays: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 10,
                    items: { $ref: '#/$defs/display' },
                },
                default_sort: { $ref: '#/$defs/configurationId' },
                sort_options: {
                    type: 'array',
                    items: { $ref: '#/$defs/sortOption' },
                },
            },
            required: ['default_display', 'displays'],
            additionalProperties: false,
        },
    },
} satisfies JSONSchema;

/**
 * Structural schema for project-scoped Views saved through the Views API.
 *
 * App-contributed and inline View definitions use the reusable base schema,
 * while persisted resources additionally document their purpose.
 */
export const PersistedViewExperienceConfigurationJsonSchema = {
    ...ViewExperienceConfigurationJsonSchema,
    $id: PERSISTED_VIEW_EXPERIENCE_CONFIGURATION_JSON_SCHEMA_ID,
    title: 'Persisted View Experience',
    properties: {
        ...ViewExperienceConfigurationJsonSchema.properties,
        description: {
            ...ViewExperienceConfigurationJsonSchema.properties.description,
            minLength: 1,
        },
    },
    required: ['name', 'description'],
} satisfies JSONSchema;
