import { z } from 'zod';
import { DashboardStatus } from '../data-platform.js';
import { StringValueMapSchema } from './files.js';
import { EditRevisionSchema, ExpectedEditRevisionSchema } from './schema-primitives.js';

export const DashboardElasticsearchResultMappingSchema = z
    .discriminatedUnion('type', [
        z.strictObject({
            type: z.literal('hits'),
        }),
        z.strictObject({
            type: z.literal('aggregation_buckets'),
            path: z.string().meta({ description: 'Dot path under `aggregations` that contains a `buckets` array.' }),
            keyField: z
                .string()
                .meta({ description: 'Output field name for bucket key. Defaults to `key`.' })
                .optional(),
            countField: z
                .string()
                .meta({ description: 'Output field name for doc count. Defaults to `doc_count`.' })
                .optional(),
        }),
    ])
    .meta({
        id: 'DashboardElasticsearchResultMapping',
        type: 'object',
        discriminator: { propertyName: 'type' },
        required: ['type'],
        description: 'How an Elasticsearch DSL result should be converted into Vega rows.',
    });

export const DashboardElasticsearchDslSchema = z
    .strictObject({
        query: z.looseObject({}).optional(),
        aggs: z.looseObject({}).optional(),
        size: z.number().optional(),
        from: z.number().optional(),
        sort: z.array(z.looseObject({})).optional(),
    })
    .meta({
        id: 'DashboardElasticsearchDsl',
        description:
            'Elasticsearch DSL supported by dashboard data sources. Queries execute through Vertesia Store, so project/security filtering remains server-side.',
    });

export const DashboardSqlDataSourceSchema = z
    .strictObject({
        kind: z.literal('data_sql'),
        query: z.string().meta({ description: 'SQL query that returns all rows for the dashboard.' }),
        queryLimit: z.number().meta({ description: 'Maximum rows to return from the query.' }).optional(),
        queryParameters: StringValueMapSchema.meta({
            description: 'Default values for SQL {{param}} placeholders.',
        }).optional(),
    })
    .meta({ id: 'DashboardSqlDataSource', description: 'Dashboard data source backed by a Data Platform SQL query.' });

export const DashboardVersioningStatusResponseSchema = z
    .strictObject({
        versioning_enabled: z.boolean(),
    })
    .meta({ id: 'DashboardVersioningStatusResponse' });

export const DashboardVersioningPayloadSchema = z
    .strictObject({
        enabled: z.boolean(),
    })
    .meta({ id: 'DashboardVersioningPayload' });

export const PromoteDashboardVersionPayloadSchema = z
    .strictObject({
        message: z.string().meta({ description: 'Commit message for the promotion' }).optional(),
    })
    .meta({ id: 'PromoteDashboardVersionPayload', description: 'Payload for promoting a version to current.' });

export const DashboardVersionItemSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Version ID' }),
        dashboard_id: z.string().meta({ description: 'Parent dashboard ID' }),
        version_number: z.number().meta({ description: 'Version number' }),
        message: z.string().meta({ description: 'Commit message' }),
        is_current: z.boolean().meta({ description: 'Whether this is the current version' }),
        is_snapshot: z.boolean().meta({ description: 'Whether this is a named snapshot' }),
        snapshot_name: z.string().meta({ description: 'Snapshot name (if is_snapshot)' }).optional(),
        panel_count: z.number().meta({ description: 'Number of panels in this version' }),
        query_count: z.number().meta({ description: 'Number of queries in this version' }),
        created_at: z.string().meta({ description: 'Creation timestamp' }),
        created_by: z.string().meta({ description: 'User/agent who created' }).optional(),
    })
    .meta({ id: 'DashboardVersionItem', description: 'Summary view of a dashboard version (for listings).' });

export const DashboardStatusSchema = z
    .enum(DashboardStatus)
    .meta({ id: 'DashboardStatus', description: 'Dashboard lifecycle status.' });

export const DashboardLayoutSchema = z
    .strictObject({
        columns: z.number().meta({ description: 'Number of columns in the grid (default: 2)' }),
        cellWidth: z.number().meta({ description: 'Width of each cell in pixels (default: 600)' }),
        cellHeight: z.number().meta({ description: 'Height of each cell in pixels (default: 400)' }),
        padding: z.number().meta({ description: 'Padding between cells in pixels (default: 20)' }),
    })
    .meta({ id: 'DashboardLayout', description: 'Dashboard layout configuration.' });

export const DashboardPanelPositionSchema = z
    .strictObject({
        row: z.number().meta({ description: 'Row index (0-based)' }),
        col: z.number().meta({ description: 'Column index (0-based)' }),
        width: z.number().meta({ description: 'Width in grid cells (default: 1)' }).optional(),
        height: z.number().meta({ description: 'Height in grid cells (default: 1)' }).optional(),
    })
    .meta({ id: 'DashboardPanelPosition', description: 'Panel position within the dashboard grid.' });

export const DashboardQuerySchema = z
    .strictObject({
        name: z.string().meta({ description: 'Query name (used as data source reference in Vega specs)' }),
        sql: z.string().meta({
            description: 'SQL query (SELECT only). Can include {{param_name}} placeholders for dynamic values.',
        }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        limit: z.number().meta({ description: 'Maximum rows to return' }).optional(),
        parameters: StringValueMapSchema.meta({
            description: 'Default values for SQL parameters. Keys are parameter names (without braces).',
        }).optional(),
    })
    .meta({
        id: 'DashboardQuery',
        description:
            'Named SQL query that maps to a Vega data source. Supports parameterized SQL with {{param_name}} placeholders.',
    });

export const DashboardBulkDeleteResultSchema = z
    .strictObject({
        deleted: z.number(),
        failed: z.number(),
    })
    .meta({ id: 'DashboardBulkDeleteResult' });

export const DashboardArchiveResultSchema = z
    .strictObject({
        id: z.string(),
        status: DashboardStatusSchema,
    })
    .meta({ id: 'DashboardArchiveResult' });

export const CreateDashboardSnapshotPayloadSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Snapshot name (must be unique within dashboard)' }),
        message: z.string().meta({ description: 'Snapshot description/message' }),
    })
    .meta({ id: 'CreateDashboardSnapshotPayload', description: 'Payload for creating a named snapshot.' });

export const DashboardBulkArchiveResultSchema = z
    .strictObject({
        archived: z.number(),
        failed: z.number(),
    })
    .meta({ id: 'DashboardBulkArchiveResult' });

export const StringArrayMapSchema = z.object({}).catchall(z.array(z.string())).meta({ id: 'StringArrayMap' });

export const DashboardStoreElasticsearchDataSourceSchema = z
    .strictObject({
        kind: z.literal('store_es_dsl'),
        dsl: DashboardElasticsearchDslSchema.meta({
            description: 'Elasticsearch DSL query executed through the secured Store query API.',
        }),
        result: DashboardElasticsearchResultMappingSchema.meta({
            description: 'Result mapping. Defaults to `hits`.',
        }).optional(),
    })
    .meta({
        id: 'DashboardStoreElasticsearchDataSource',
        description: 'Dashboard data source backed by Vertesia Store Elasticsearch DSL.',
    });

export const DashboardVersionItemArraySchema = z
    .array(DashboardVersionItemSchema)
    .meta({ id: 'DashboardVersionItemArray' });

export const DashboardItemSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        edit_revision: EditRevisionSchema,
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        store_id: z.string().meta({ description: 'Parent data store ID' }),
        status: DashboardStatusSchema.meta({ description: 'Current status' }),
        panel_count: z.number().meta({ description: 'Number of panels (deprecated, kept for backwards compat)' }),
        query_count: z.number().meta({ description: 'Number of queries (deprecated, kept for backwards compat)' }),
        last_rendered_at: z.string().meta({ description: 'Last render timestamp' }).optional(),
        source: z
            .enum(['stored', 'app'])
            .meta({ description: 'Source of the dashboard definition. Defaults to stored dashboards.' })
            .optional(),
        app_name: z.string().meta({ description: 'App name when `source` is `app`.' }).optional(),
        readonly: z
            .boolean()
            .meta({ description: 'App dashboards are read-only until cloned into a stored dashboard.' })
            .optional(),
    })
    .meta({ id: 'DashboardItem', description: 'Summary view of a dashboard (for listings).' });

export const DashboardPanelSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Panel ID (auto-generated if not provided)' }).optional(),
        title: z.string().meta({ description: 'Panel title' }),
        spec: z.looseObject({}).meta({ description: 'Vega or Vega-Lite specification' }),
        vegaLite: z.boolean().meta({ description: 'Whether spec is Vega-Lite (default: true)' }).optional(),
        dataSources: z.array(z.string()).meta({ description: "Query names that populate this panel's data sources" }),
        position: DashboardPanelPositionSchema.meta({ description: 'Position in the dashboard grid' }),
    })
    .meta({ id: 'DashboardPanel', description: 'Dashboard panel with Vega/Vega-Lite visualization.' });

export const DashboardDataSourceSchema = z
    .discriminatedUnion('kind', [DashboardSqlDataSourceSchema, DashboardStoreElasticsearchDataSourceSchema])
    .meta({ id: 'DashboardDataSource', description: 'Data source for a Vega dashboard.' });

export const DashboardItemArraySchema = z.array(DashboardItemSchema).meta({ id: 'DashboardItemArray' });

export const DashboardVersionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Version ID' }),
        dashboard_id: z.string().meta({ description: 'Parent dashboard ID' }),
        version_number: z.number().meta({ description: 'Version number (auto-incremented)' }),
        message: z.string().meta({ description: 'Commit message describing the change' }),
        dataSource: DashboardDataSourceSchema.meta({
            description: 'Snapshot of v2 data source at this version',
        }).optional(),
        query: z.string().meta({ description: 'Snapshot of v2 SQL query at this version' }).optional(),
        queryLimit: z.number().meta({ description: 'Snapshot of v2 query limit at this version' }).optional(),
        queryParameters: StringValueMapSchema.meta({
            description: 'Snapshot of v2 query parameters at this version',
        }).optional(),
        spec: z.looseObject({}).meta({ description: 'Snapshot of v2 Vega-Lite spec at this version' }).optional(),
        queries: z.array(DashboardQuerySchema).meta({ description: 'Snapshot of queries at this version' }),
        panels: z.array(DashboardPanelSchema).meta({ description: 'Snapshot of panels at this version' }),
        layout: DashboardLayoutSchema.meta({ description: 'Snapshot of layout at this version' }),
        is_current: z.boolean().meta({ description: 'Whether this is the currently active/displayed version' }),
        is_snapshot: z.boolean().meta({ description: 'Whether this is a named snapshot (protected from TTL cleanup)' }),
        snapshot_name: z.string().meta({ description: 'Snapshot name (if is_snapshot)' }).optional(),
        created_at: z.string().meta({ description: 'Creation timestamp' }),
        created_by: z.string().meta({ description: 'User/agent who created this version' }).optional(),
    })
    .meta({
        id: 'DashboardVersion',
        description:
            'A point-in-time version of a dashboard. Stores full snapshot inline (no external storage needed for small JSON documents).',
    });

export const DashboardSchema = DashboardItemSchema.extend({
    dataSource: DashboardDataSourceSchema.meta({
        description:
            'Data source used to populate Vega `data.values`. When omitted, top-level `query` is treated as a SQL data source for backwards compatibility.',
    }).optional(),
    query: z
        .string()
        .meta({
            description:
                "SQL query that returns all data for the dashboard. Use JOINs, CTEs, or UNION ALL to combine data from multiple tables. Can include {{param_name}} placeholders for dynamic values.\n\nDeprecated: Use `dataSource: { kind: 'data_sql', query }` instead.",
            deprecated: true,
            'x-deprecated-message': "Use `dataSource: { kind: 'data_sql', query }` instead.",
        })
        .optional(),
    queryLimit: z
        .number()
        .meta({
            description:
                'Maximum rows to return from the query (default: 10000).\n\nDeprecated: Use `dataSource.queryLimit` instead.',
            deprecated: true,
            'x-deprecated-message': 'Use `dataSource.queryLimit` instead.',
        })
        .optional(),
    queryParameters: StringValueMapSchema.meta({
        description: 'Default values for SQL parameters.\n\nDeprecated: Use `dataSource.queryParameters` instead.',
        deprecated: true,
        'x-deprecated-message': 'Use `dataSource.queryParameters` instead.',
    }).optional(),
    spec: z
        .looseObject({})
        .meta({
            description:
                'Complete Vega-Lite specification for the entire dashboard. Use vconcat/hconcat for multiple panels, params for interactivity. Data is injected at runtime from query results.',
        })
        .optional(),
    queries: z.array(DashboardQuerySchema).meta({
        description:
            'Deprecated: Use single `query` field instead.\nNamed SQL queries (kept for backwards compatibility).',
        deprecated: true,
        'x-deprecated-message':
            'Use single `query` field instead.\nNamed SQL queries (kept for backwards compatibility).',
    }),
    panels: z.array(DashboardPanelSchema).meta({
        description:
            'Deprecated: Use single `spec` field with vconcat/hconcat instead.\nPanel definitions (kept for backwards compatibility).',
        deprecated: true,
        'x-deprecated-message':
            'Use single `spec` field with vconcat/hconcat instead.\nPanel definitions (kept for backwards compatibility).',
    }),
    layout: DashboardLayoutSchema.meta({
        description:
            'Deprecated: Layout is now handled within the Vega-Lite spec.\nLayout configuration (kept for backwards compatibility).',
        deprecated: true,
        'x-deprecated-message':
            'Layout is now handled within the Vega-Lite spec.\nLayout configuration (kept for backwards compatibility).',
    }),
    last_render_url: z.string().meta({ description: 'URL of last rendered image' }).optional(),
}).meta({
    id: 'Dashboard',
    description:
        'Full dashboard with SQL query and Vega-Lite specification.\n\n**New architecture (v2):**\n- `dataSource` field with either SQL or Store Elasticsearch DSL\n- Single `spec` field with complete Vega-Lite spec (vconcat/hconcat for multiple panels)\n- Cross-panel interactivity via Vega selections\n- Legacy top-level `query` fields are treated as a SQL data source\n\n**Legacy architecture (v1, deprecated):**\n- Multiple `queries` with named data sources\n- Multiple `panels` with separate specs and dataSources references\n- `layout` for grid positioning\n- No cross-panel interactivity',
});

export const CreateDashboardPayloadSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Dashboard name (unique within store)' }),
        summary: z.string().meta({ description: 'Dashboard summary' }).optional(),
        dataSource: DashboardDataSourceSchema.meta({
            description: 'Data source used to populate Vega `data.values`.',
        }).optional(),
        query: z
            .string()
            .meta({
                description:
                    'SQL query that returns all data for the dashboard. Deprecated shortcut for a SQL data source.',
            })
            .optional(),
        queryLimit: z
            .number()
            .meta({ description: 'Maximum rows to return from the query (default: 10000)' })
            .optional(),
        queryParameters: StringValueMapSchema.meta({
            description: 'Default values for SQL {{param}} placeholders',
        }).optional(),
        spec: z
            .looseObject({})
            .meta({ description: 'Complete Vega-Lite specification (use vconcat/hconcat for multiple panels)' }),
    })
    .meta({
        id: 'CreateDashboardPayload',
        description: 'Payload for creating a new dashboard. Requires a data source and spec (Vega-Lite).',
    });

export const UpdateDashboardPayloadSchema = CreateDashboardPayloadSchema.partial()
    .extend({
        expected_edit_revision: ExpectedEditRevisionSchema,
        name: z.string().meta({ description: 'Dashboard name' }).optional(),
        skip_versioning: z.boolean().meta({ description: 'Skip auto-version creation' }).optional(),
    })
    .meta({ id: 'UpdateDashboardPayload', description: 'Payload for updating a dashboard.' });
