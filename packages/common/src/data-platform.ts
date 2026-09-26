import type * as Wire from './wire-types.generated.js';

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

export type DataColumnType = Wire.DataColumnType;

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

export type SemanticColumnType = Wire.SemanticColumnType;

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
export type DataColumn = Wire.DataColumn;

/**
 * Foreign key constraint definition.
 */
export type DataForeignKey = Wire.DataForeignKey;

/**
 * Index definition for a table.
 */
export type DataIndex = Wire.DataIndex;

/**
 * Semantic type categorization for tables.
 */
export type DataTableSemanticType = Wire.DataTableSemanticType;

/**
 * Table definition within a data schema.
 */
export type DataTable = Wire.DataTable;

/**
 * Summary view of a data table (for listings).
 */
export type DataTableSummary = Wire.DataTableSummary;

/**
 * Relationship type between tables.
 */
export type DataRelationshipType = Wire.DataRelationshipType;

/**
 * Semantic relationship between tables for AI understanding.
 */
export type DataRelationship = Wire.DataRelationship;

/**
 * Complete schema definition for a data store.
 */
export type DataSchema = Wire.DataSchema;

export type DataStoreFullSchemaResponse = Wire.DataStoreFullSchemaResponse;

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

export type DataStoreStatus = Wire.DataStoreStatus;

/**
 * Summary view of a data store (for listings).
 */
export type DataStoreItem = Wire.DataStoreItem;

/**
 * Full data store with schema details.
 */
export type DataStore = Wire.DataStore;

// ============================================================================
// Version Types
// ============================================================================

/**
 * Table state within a version.
 */
export type DataStoreVersionTableState = Wire.DataStoreVersionTableState;

/**
 * A point-in-time version of a data store.
 */
export type DataStoreVersion = Wire.DataStoreVersion;

export type ListDataStoreVersionsQuery = Wire.ListDataStoreVersionsQuery;

export type GetDataStoreTableQuery = Wire.GetDataStoreTableQuery;

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

export type ImportStatus = Wire.ImportStatus;

/**
 * Import job tracking.
 */
export type ImportJob = Wire.ImportJob;

// ============================================================================
// API Payloads
// ============================================================================

/**
 * Payload for creating a new data store.
 */
export type CreateDataStorePayload = Wire.CreateDataStorePayload;

/**
 * Payload for creating a new table.
 */
export type CreateTablePayload = Wire.CreateTablePayload;

/**
 * Payload for creating multiple tables atomically.
 */
export type CreateTablesPayload = Wire.CreateTablesPayload;

export type QueryValidationPayload = Wire.QueryValidationPayload;

export type BatchQueryPayload = Wire.BatchQueryPayload;

/**
 * Schema change operation types.
 */
/**
 * @discriminator op
 */
export type AlterTableOperation = Wire.AlterTableOperation;

/**
 * Payload for altering a table schema.
 */
export type AlterTablePayload = Wire.AlterTablePayload;

/**
 * Payload for AI-driven bulk schema updates.
 */
export type UpdateSchemaPayload = Wire.UpdateSchemaPayload;

/**
 * Data source for import.
 * - 'inline': data provided directly in the payload
 * - 'gcs': data in Google Cloud Storage (gs://bucket/path)
 * - 'url': data at an HTTPS URL
 * - 'artifact': data from workflow artifact (resolved to GCS by tool)
 */
export type ImportDataSource = Wire.ImportDataSource;

/**
 * Data format for external sources.
 */
export type ImportDataFormat = Wire.ImportDataFormat;

/**
 * Table data specification for import.
 */
export type ImportTableData = Wire.ImportTableData;

/**
 * Payload for importing data into tables.
 */
export type ImportDataPayload = Wire.ImportDataPayload;

/**
 * Payload for creating a named snapshot.
 */
export type CreateSnapshotPayload = Wire.CreateSnapshotPayload;

/**
 * Payload for executing a query.
 */
export type QueryPayload = Wire.QueryPayload;

/**
 * Payload for mutating data rows with a single SQL statement.
 */
export type DataStoreMutateRowsPayload = Wire.DataStoreMutateRowsPayload;

/**
 * Result from mutating rows in a data store.
 */
export type DataStoreMutateRowsResult = Wire.DataStoreMutateRowsResult;

/**
 * Column metadata in query results.
 */
export type QueryResultColumn = Wire.QueryResultColumn;

/**
 * Query execution result.
 */
export type QueryResult = Wire.QueryResult;

export type BatchQueryResultItem = Wire.BatchQueryResultItem;

export type BatchQueryResult = Wire.BatchQueryResult;

export type QueryValidationError = Wire.QueryValidationError;

export type QueryValidationResult = Wire.QueryValidationResult;

export type DataStoreDownloadInfo = Wire.DataStoreDownloadInfo;

export type DataStoreArchiveResult = Wire.DataStoreArchiveResult;

/**
 * @discriminator schema_format
 */
export type DataStoreSchemaResponse = Wire.DataStoreSchemaResponse;

export type DataStoreTableDetail = Wire.DataStoreTableDetail;

export type DataStoreTableDropResult = Wire.DataStoreTableDropResult;

export type DashboardArchiveResult = Wire.DashboardArchiveResult;

export type DashboardBulkArchiveResult = Wire.DashboardBulkArchiveResult;

export type DashboardBulkDeleteResult = Wire.DashboardBulkDeleteResult;

export type DashboardVersioningStatusResponse = Wire.DashboardVersioningStatusResponse;

export type DashboardVersioningPayload = Wire.DashboardVersioningPayload;

// ============================================================================
// AI Agent Interface
// ============================================================================

/**
 * Simplified column representation for AI agents.
 */
export type DataColumnForAI = Wire.DataColumnForAI;

/**
 * Simplified foreign key representation for AI agents.
 */
export type DataForeignKeyForAI = Wire.DataForeignKeyForAI;

/**
 * Simplified table representation for AI agents.
 */
export type DataTableForAI = Wire.DataTableForAI;

/**
 * Simplified relationship representation for AI agents.
 */
export type DataRelationshipForAI = Wire.DataRelationshipForAI;

/**
 * Simplified schema representation optimized for AI agent consumption.
 * Provides semantic context for understanding the data model.
 */
export type DataSchemaForAI = Wire.DataSchemaForAI;

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

export type DashboardStatus = Wire.DashboardStatus;

/**
 * Named SQL query that maps to a Vega data source.
 * Supports parameterized SQL with {{param_name}} placeholders.
 *
 * @deprecated Use single `query` field on Dashboard instead. Multiple queries
 * prevent cross-panel interactivity. Use JOINs/CTEs in a single query.
 */
export type DashboardQuery = Wire.DashboardQuery;

/**
 * Panel position within the dashboard grid.
 *
 * @deprecated Use combined Vega-Lite spec with vconcat/hconcat instead.
 */
export type DashboardPanelPosition = Wire.DashboardPanelPosition;

/**
 * Dashboard panel with Vega/Vega-Lite visualization.
 *
 * @deprecated Use combined Vega-Lite spec with vconcat/hconcat instead.
 * Combined specs enable cross-panel interactivity (selections filtering other panels).
 */
export type DashboardPanel = Wire.DashboardPanel;

/**
 * Dashboard layout configuration.
 *
 * @deprecated Layout is now handled within the Vega-Lite spec via vconcat/hconcat.
 */
export type DashboardLayout = Wire.DashboardLayout;

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
export type DashboardElasticsearchDsl = Wire.DashboardElasticsearchDsl;

/**
 * How an Elasticsearch DSL result should be converted into Vega rows.
 */
export type DashboardElasticsearchResultMapping = Wire.DashboardElasticsearchResultMapping;

/**
 * Dashboard data source backed by a Data Platform SQL query.
 */
export type DashboardSqlDataSource = Wire.DashboardSqlDataSource;

/**
 * Dashboard data source backed by Vertesia Store Elasticsearch DSL.
 */
export type DashboardStoreElasticsearchDataSource = Wire.DashboardStoreElasticsearchDataSource;

/**
 * Data source for a Vega dashboard.
 */
export type DashboardDataSource = Wire.DashboardDataSource;

/**
 * Dashboard definition contributed by an app package.
 *
 * App dashboard IDs are local to the app. The platform exposes them as
 * `app:<app_name>:<id>` when listing or retrieving dashboards.
 */
export type AppDashboardDefinition = Wire.AppDashboardDefinition;

/**
 * Summary view of a dashboard (for listings).
 */
export type DashboardItem = Wire.DashboardItem;

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
export type Dashboard = Wire.Dashboard;

/**
 * Payload for creating a new dashboard.
 * Requires a data source and spec (Vega-Lite).
 */
export type CreateDashboardPayload = Wire.CreateDashboardPayload;

/**
 * Payload for updating a dashboard.
 */
export type UpdateDashboardPayload = Wire.UpdateDashboardPayload;

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
export type DashboardVersion = Wire.DashboardVersion;

/**
 * Summary view of a dashboard version (for listings).
 */
export type DashboardVersionItem = Wire.DashboardVersionItem;

/**
 * Payload for creating a named snapshot.
 */
export type CreateDashboardSnapshotPayload = Wire.CreateDashboardSnapshotPayload;

/**
 * Payload for promoting a version to current.
 */
export type PromoteDashboardVersionPayload = Wire.PromoteDashboardVersionPayload;

export type DataColumnUpdate = Wire.DataColumnUpdate;
