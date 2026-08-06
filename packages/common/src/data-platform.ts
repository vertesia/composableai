import type { AppDashboardDefinitionSchema } from './api-schemas/app-runtime.js';
/**
 * Data Platform Types
 *
 * Types for managing versioned analytical data stores with DuckDB + GCS storage.
 * Supports AI-manageable schemas and multi-table atomic operations.
 */

import type { z } from 'zod';
import type {
    CreateDashboardPayloadSchema,
    CreateDashboardSnapshotPayloadSchema,
    DashboardArchiveResultSchema,
    DashboardBulkArchiveResultSchema,
    DashboardBulkDeleteResultSchema,
    DashboardDataSourceSchema,
    DashboardElasticsearchDslSchema,
    DashboardElasticsearchResultMappingSchema,
    DashboardItemSchema,
    DashboardLayoutSchema,
    DashboardPanelPositionSchema,
    DashboardPanelSchema,
    DashboardQuerySchema,
    DashboardSchema,
    DashboardSqlDataSourceSchema,
    DashboardStatusSchema,
    DashboardStoreElasticsearchDataSourceSchema,
    DashboardVersionItemSchema,
    DashboardVersioningPayloadSchema,
    DashboardVersioningStatusResponseSchema,
    DashboardVersionSchema,
    PromoteDashboardVersionPayloadSchema,
    UpdateDashboardPayloadSchema,
} from './api-schemas/dashboard.js';
import type {
    AlterTableOperationSchema,
    AlterTablePayloadSchema,
    BatchQueryPayloadSchema,
    BatchQueryResultItemSchema,
    BatchQueryResultSchema,
    CreateDataStorePayloadSchema,
    CreateSnapshotPayloadSchema,
    CreateTablePayloadSchema,
    CreateTablesPayloadSchema,
    DataColumnForAISchema,
    DataColumnSchema,
    DataColumnTypeSchema,
    DataForeignKeyForAISchema,
    DataForeignKeySchema,
    DataIndexSchema,
    DataRelationshipForAISchema,
    DataRelationshipSchema,
    DataRelationshipTypeSchema,
    DataSchemaForAISchema,
    DataSchemaSchema,
    DataStoreArchiveResultSchema,
    DataStoreDownloadInfoSchema,
    DataStoreFullSchemaResponseSchema,
    DataStoreItemSchema,
    DataStoreMutateRowsPayloadSchema,
    DataStoreMutateRowsResultSchema,
    DataStoreSchema,
    DataStoreSchemaResponseSchema,
    DataStoreStatusSchema,
    DataStoreTableDetailSchema,
    DataStoreTableDropResultSchema,
    DataStoreVersionSchema,
    DataStoreVersionTableStateSchema,
    DataTableForAISchema,
    DataTableSchema,
    DataTableSemanticTypeSchema,
    DataTableSummarySchema,
    GetDataStoreTableQuerySchema,
    ImportDataFormatSchema,
    ImportDataPayloadSchema,
    ImportDataSourceSchema,
    ImportJobSchema,
    ImportStatusSchema,
    ImportTableDataSchema,
    ListDataStoreVersionsQuerySchema,
    QueryPayloadSchema,
    QueryResultColumnSchema,
    QueryResultSchema,
    QueryValidationErrorSchema,
    QueryValidationPayloadSchema,
    QueryValidationResultSchema,
    SemanticColumnTypeSchema,
    UpdateSchemaPayloadSchema,
} from './api-schemas/data-store.js';

// ============================================================================
// Column Types
// ============================================================================

/**
 * Supported column data types for DuckDB tables.
 */
export const DataColumnType = {
    STRING: 'STRING',
    INTEGER: 'INTEGER',
    BIGINT: 'BIGINT',
    FLOAT: 'FLOAT',
    DOUBLE: 'DOUBLE',
    DECIMAL: 'DECIMAL',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    TIMESTAMP: 'TIMESTAMP',
    JSON: 'JSON',
} as const;

export type DataColumnType = z.infer<typeof DataColumnTypeSchema>;

/**
 * Semantic types that provide AI agents with context about column meaning.
 */
export const SemanticColumnType = {
    EMAIL: 'email',
    PHONE: 'phone',
    URL: 'url',
    CURRENCY: 'currency',
    PERCENTAGE: 'percentage',
    PERSON_NAME: 'person_name',
    ADDRESS: 'address',
    COUNTRY: 'country',
    DATE_ISO: 'date_iso',
    IDENTIFIER: 'identifier',
} as const;

export type SemanticColumnType = z.infer<typeof SemanticColumnTypeSchema>;

/**
 * Mapping from DataColumnType to DuckDB SQL types.
 */
export const DATA_COLUMN_TYPE_TO_DUCKDB: Record<DataColumnType, string> = {
    [DataColumnType.STRING]: 'VARCHAR',
    [DataColumnType.INTEGER]: 'INTEGER',
    [DataColumnType.BIGINT]: 'BIGINT',
    [DataColumnType.FLOAT]: 'FLOAT',
    [DataColumnType.DOUBLE]: 'DOUBLE',
    [DataColumnType.DECIMAL]: 'DECIMAL(18,4)',
    [DataColumnType.BOOLEAN]: 'BOOLEAN',
    [DataColumnType.DATE]: 'DATE',
    [DataColumnType.TIMESTAMP]: 'TIMESTAMP',
    [DataColumnType.JSON]: 'JSON',
};

// ============================================================================
// Schema Types
// ============================================================================

/**
 * Column definition for a data table.
 */
export type DataColumn = z.infer<typeof DataColumnSchema>;

/**
 * Foreign key constraint definition.
 */
export type DataForeignKey = z.infer<typeof DataForeignKeySchema>;

/**
 * Index definition for a table.
 */
export type DataIndex = z.infer<typeof DataIndexSchema>;

/**
 * Semantic type categorization for tables.
 */
export type DataTableSemanticType = z.infer<typeof DataTableSemanticTypeSchema>;

/**
 * Table definition within a data schema.
 */
export type DataTable = z.infer<typeof DataTableSchema>;

/**
 * Summary view of a data table (for listings).
 */
export type DataTableSummary = z.infer<typeof DataTableSummarySchema>;

/**
 * Relationship type between tables.
 */
export type DataRelationshipType = z.infer<typeof DataRelationshipTypeSchema>;

/**
 * Semantic relationship between tables for AI understanding.
 */
export type DataRelationship = z.infer<typeof DataRelationshipSchema>;

/**
 * Complete schema definition for a data store.
 */
export type DataSchema = z.infer<typeof DataSchemaSchema>;

export type DataStoreFullSchemaResponse = z.infer<typeof DataStoreFullSchemaResponseSchema>;

// ============================================================================
// Data Store Types
// ============================================================================

/**
 * Data store lifecycle status.
 */
export const DataStoreStatus = {
    CREATING: 'creating',
    ACTIVE: 'active',
    ERROR: 'error',
    ARCHIVED: 'archived',
} as const;

export type DataStoreStatus = z.infer<typeof DataStoreStatusSchema>;

/**
 * Summary view of a data store (for listings).
 */
export type DataStoreItem = z.infer<typeof DataStoreItemSchema>;

/**
 * Full data store with schema details.
 */
export type DataStore = z.infer<typeof DataStoreSchema>;

// ============================================================================
// Version Types
// ============================================================================

/**
 * Table state within a version.
 */
export type DataStoreVersionTableState = z.infer<typeof DataStoreVersionTableStateSchema>;

/**
 * A point-in-time version of a data store.
 */
export type DataStoreVersion = z.infer<typeof DataStoreVersionSchema>;

export type ListDataStoreVersionsQuery = z.infer<typeof ListDataStoreVersionsQuerySchema>;

export type GetDataStoreTableQuery = z.infer<typeof GetDataStoreTableQuerySchema>;

// ============================================================================
// Import Types
// ============================================================================

/**
 * Import job status.
 */
export const ImportStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    ROLLED_BACK: 'rolled_back',
} as const;

export type ImportStatus = z.infer<typeof ImportStatusSchema>;

/**
 * Import job tracking.
 */
export type ImportJob = z.infer<typeof ImportJobSchema>;

// ============================================================================
// API Payloads
// ============================================================================

/**
 * Payload for creating a new data store.
 */
export type CreateDataStorePayload = z.infer<typeof CreateDataStorePayloadSchema>;

/**
 * Payload for creating a new table.
 */
export type CreateTablePayload = z.infer<typeof CreateTablePayloadSchema>;

/**
 * Payload for creating multiple tables atomically.
 */
export type CreateTablesPayload = z.infer<typeof CreateTablesPayloadSchema>;

export type QueryValidationPayload = z.infer<typeof QueryValidationPayloadSchema>;

export type BatchQueryPayload = z.infer<typeof BatchQueryPayloadSchema>;

/**
 * Schema change operation types.
 */
/**
 * @discriminator op
 */
export type AlterTableOperation = z.infer<typeof AlterTableOperationSchema>;

/**
 * Payload for altering a table schema.
 */
export type AlterTablePayload = z.infer<typeof AlterTablePayloadSchema>;

/**
 * Payload for AI-driven bulk schema updates.
 */
export type UpdateSchemaPayload = z.infer<typeof UpdateSchemaPayloadSchema>;

/**
 * Data source for import.
 * - 'inline': data provided directly in the payload
 * - 'gcs': data in Google Cloud Storage (gs://bucket/path)
 * - 'url': data at an HTTPS URL
 * - 'artifact': data from workflow artifact (resolved to GCS by tool)
 */
export type ImportDataSource = z.infer<typeof ImportDataSourceSchema>;

/**
 * Data format for external sources.
 */
export type ImportDataFormat = z.infer<typeof ImportDataFormatSchema>;

/**
 * Table data specification for import.
 */
export type ImportTableData = z.infer<typeof ImportTableDataSchema>;

/**
 * Payload for importing data into tables.
 */
export type ImportDataPayload = z.infer<typeof ImportDataPayloadSchema>;

/**
 * Payload for creating a named snapshot.
 */
export type CreateSnapshotPayload = z.infer<typeof CreateSnapshotPayloadSchema>;

/**
 * Payload for executing a query.
 */
export type QueryPayload = z.infer<typeof QueryPayloadSchema>;

/**
 * Payload for mutating data rows with a single SQL statement.
 */
export type DataStoreMutateRowsPayload = z.infer<typeof DataStoreMutateRowsPayloadSchema>;

/**
 * Result from mutating rows in a data store.
 */
export type DataStoreMutateRowsResult = z.infer<typeof DataStoreMutateRowsResultSchema>;

/**
 * Column metadata in query results.
 */
export type QueryResultColumn = z.infer<typeof QueryResultColumnSchema>;

/**
 * Query execution result.
 */
export type QueryResult = z.infer<typeof QueryResultSchema>;

export type BatchQueryResultItem = z.infer<typeof BatchQueryResultItemSchema>;

export type BatchQueryResult = z.infer<typeof BatchQueryResultSchema>;

export type QueryValidationError = z.infer<typeof QueryValidationErrorSchema>;

export type QueryValidationResult = z.infer<typeof QueryValidationResultSchema>;

export type DataStoreDownloadInfo = z.infer<typeof DataStoreDownloadInfoSchema>;

export type DataStoreArchiveResult = z.infer<typeof DataStoreArchiveResultSchema>;

/**
 * @discriminator schema_format
 */
export type DataStoreSchemaResponse = z.infer<typeof DataStoreSchemaResponseSchema>;

export type DataStoreTableDetail = z.infer<typeof DataStoreTableDetailSchema>;

export type DataStoreTableDropResult = z.infer<typeof DataStoreTableDropResultSchema>;

export type DashboardArchiveResult = z.infer<typeof DashboardArchiveResultSchema>;

export type DashboardBulkArchiveResult = z.infer<typeof DashboardBulkArchiveResultSchema>;

export type DashboardBulkDeleteResult = z.infer<typeof DashboardBulkDeleteResultSchema>;

export type DashboardVersioningStatusResponse = z.infer<typeof DashboardVersioningStatusResponseSchema>;

export type DashboardVersioningPayload = z.infer<typeof DashboardVersioningPayloadSchema>;

// ============================================================================
// AI Agent Interface
// ============================================================================

/**
 * Simplified column representation for AI agents.
 */
export type DataColumnForAI = z.infer<typeof DataColumnForAISchema>;

/**
 * Simplified foreign key representation for AI agents.
 */
export type DataForeignKeyForAI = z.infer<typeof DataForeignKeyForAISchema>;

/**
 * Simplified table representation for AI agents.
 */
export type DataTableForAI = z.infer<typeof DataTableForAISchema>;

/**
 * Simplified relationship representation for AI agents.
 */
export type DataRelationshipForAI = z.infer<typeof DataRelationshipForAISchema>;

/**
 * Simplified schema representation optimized for AI agent consumption.
 * Provides semantic context for understanding the data model.
 */
export type DataSchemaForAI = z.infer<typeof DataSchemaForAISchema>;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Version retention configuration.
 */
interface DataStoreRetentionConfig {
    /** Keep versions for this many days */
    retention_days: number;
    /** Named snapshots are exempt from retention */
    snapshots_exempt: boolean;
}

/**
 * Default retention configuration: 30 days, snapshots exempt.
 */
export const DEFAULT_RETENTION_CONFIG: DataStoreRetentionConfig = {
    retention_days: 30,
    snapshots_exempt: true,
};

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard lifecycle status.
 */
export const DashboardStatus = {
    /** Dashboard is active and usable */
    ACTIVE: 'active',
    /** Dashboard has been archived (soft deleted) */
    ARCHIVED: 'archived',
} as const;

export type DashboardStatus = z.infer<typeof DashboardStatusSchema>;

/**
 * Named SQL query that maps to a Vega data source.
 * Supports parameterized SQL with {{param_name}} placeholders.
 *
 * @deprecated Use single `query` field on Dashboard instead. Multiple queries
 * prevent cross-panel interactivity. Use JOINs/CTEs in a single query.
 */
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

/**
 * Panel position within the dashboard grid.
 *
 * @deprecated Use combined Vega-Lite spec with vconcat/hconcat instead.
 */
export type DashboardPanelPosition = z.infer<typeof DashboardPanelPositionSchema>;

/**
 * Dashboard panel with Vega/Vega-Lite visualization.
 *
 * @deprecated Use combined Vega-Lite spec with vconcat/hconcat instead.
 * Combined specs enable cross-panel interactivity (selections filtering other panels).
 */
export type DashboardPanel = z.infer<typeof DashboardPanelSchema>;

/**
 * Dashboard layout configuration.
 *
 * @deprecated Layout is now handled within the Vega-Lite spec via vconcat/hconcat.
 */
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;

/**
 * Default layout configuration for dashboards.
 *
 * @deprecated Use combined Vega-Lite spec with vconcat/hconcat instead.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
    columns: 2,
    cellWidth: 600,
    cellHeight: 400,
    padding: 20,
};

/**
 * Elasticsearch DSL supported by dashboard data sources.
 * Queries execute through Vertesia Store, so project/security filtering remains server-side.
 */
export type DashboardElasticsearchDsl = z.infer<typeof DashboardElasticsearchDslSchema>;

/**
 * How an Elasticsearch DSL result should be converted into Vega rows.
 */
export type DashboardElasticsearchResultMapping = z.infer<typeof DashboardElasticsearchResultMappingSchema>;

/**
 * Dashboard data source backed by a Data Platform SQL query.
 */
export type DashboardSqlDataSource = z.infer<typeof DashboardSqlDataSourceSchema>;

/**
 * Dashboard data source backed by Vertesia Store Elasticsearch DSL.
 */
export type DashboardStoreElasticsearchDataSource = z.infer<typeof DashboardStoreElasticsearchDataSourceSchema>;

/**
 * Data source for a Vega dashboard.
 */
export type DashboardDataSource = z.infer<typeof DashboardDataSourceSchema>;

/**
 * Dashboard definition contributed by an app package.
 *
 * App dashboard IDs are local to the app. The platform exposes them as
 * `app:<app_name>:<id>` when listing or retrieving dashboards.
 */
export type AppDashboardDefinition = z.infer<typeof AppDashboardDefinitionSchema>;

/**
 * Summary view of a dashboard (for listings).
 */
export type DashboardItem = z.infer<typeof DashboardItemSchema>;

/**
 * Full dashboard with SQL query and Vega-Lite specification.
 *
 * **New architecture (v2):**
 * - `dataSource` field with either SQL or Store Elasticsearch DSL
 * - Single `spec` field with complete Vega-Lite spec (vconcat/hconcat for multiple panels)
 * - Cross-panel interactivity via Vega selections
 * - Legacy top-level `query` fields are treated as a SQL data source
 *
 * **Legacy architecture (v1, deprecated):**
 * - Multiple `queries` with named data sources
 * - Multiple `panels` with separate specs and dataSources references
 * - `layout` for grid positioning
 * - No cross-panel interactivity
 */
export type Dashboard = z.infer<typeof DashboardSchema>;

/**
 * Payload for creating a new dashboard.
 * Requires a data source and spec (Vega-Lite).
 */
export type CreateDashboardPayload = z.infer<typeof CreateDashboardPayloadSchema>;

/**
 * Payload for updating a dashboard.
 */
export type UpdateDashboardPayload = z.infer<typeof UpdateDashboardPayloadSchema>;

/**
 * Options for rendering a dashboard.
 */
export interface RenderDashboardOptions {
    /** Scale factor for higher resolution (default: 1) */
    scale?: number;
    /** Force re-render even if cached (default: false) */
    force?: boolean;
    /** Background color (default: white) */
    backgroundColor?: string;
}

// ============================================================================
// Dashboard Version Types
// ============================================================================

/**
 * A point-in-time version of a dashboard.
 * Stores full snapshot inline (no external storage needed for small JSON documents).
 */
export type DashboardVersion = z.infer<typeof DashboardVersionSchema>;

/**
 * Summary view of a dashboard version (for listings).
 */
export type DashboardVersionItem = z.infer<typeof DashboardVersionItemSchema>;

/**
 * Payload for creating a named snapshot.
 */
export type CreateDashboardSnapshotPayload = z.infer<typeof CreateDashboardSnapshotPayloadSchema>;

/**
 * Payload for promoting a version to current.
 */
export type PromoteDashboardVersionPayload = z.infer<typeof PromoteDashboardVersionPayloadSchema>;
