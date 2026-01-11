/**
 * Data Platform Types
 *
 * Types for managing versioned analytical data stores with DuckDB + GCS storage.
 * Supports AI-manageable schemas and multi-table atomic operations.
 */

import { BaseObject } from './store/common.js';

// ============================================================================
// Column Types
// ============================================================================

/**
 * Supported column data types for DuckDB tables.
 */
export enum DataColumnType {
    STRING = 'STRING',
    INTEGER = 'INTEGER',
    BIGINT = 'BIGINT',
    FLOAT = 'FLOAT',
    DOUBLE = 'DOUBLE',
    DECIMAL = 'DECIMAL',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    TIMESTAMP = 'TIMESTAMP',
    JSON = 'JSON',
}

/**
 * Semantic types that provide AI agents with context about column meaning.
 */
export enum SemanticColumnType {
    EMAIL = 'email',
    PHONE = 'phone',
    URL = 'url',
    CURRENCY = 'currency',
    PERCENTAGE = 'percentage',
    PERSON_NAME = 'person_name',
    ADDRESS = 'address',
    COUNTRY = 'country',
    DATE_ISO = 'date_iso',
    IDENTIFIER = 'identifier',
}

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
export interface DataColumn {
    /** Column name (must be valid SQL identifier) */
    name: string;
    /** Data type */
    type: DataColumnType;
    /** Human-readable description */
    description?: string;
    /** Whether the column allows NULL values */
    nullable?: boolean;
    /** Default value (SQL expression as string) */
    default?: string;
    /** Whether this is the primary key */
    primary_key?: boolean;
    /** Whether values must be unique */
    unique?: boolean;
    /** Semantic type for AI understanding */
    semantic_type?: SemanticColumnType;
    /** Example values for AI context */
    examples?: string[];
}

/**
 * Foreign key constraint definition.
 */
export interface DataForeignKey {
    /** Column in this table */
    column: string;
    /** Referenced table name */
    references_table: string;
    /** Referenced column name */
    references_column: string;
    /** Action on delete */
    on_delete?: 'CASCADE' | 'SET NULL' | 'NO ACTION';
}

/**
 * Index definition for a table.
 */
export interface DataIndex {
    /** Index name */
    name: string;
    /** Columns included in the index */
    columns: string[];
    /** Whether the index enforces uniqueness */
    unique?: boolean;
}

/**
 * Semantic type categorization for tables.
 */
export type DataTableSemanticType = 'dimension' | 'fact' | 'bridge' | 'staging';

/**
 * Table definition within a data schema.
 */
export interface DataTable {
    /** Table name (must be valid SQL identifier) */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Column definitions */
    columns: DataColumn[];
    /** Foreign key constraints */
    foreign_keys?: DataForeignKey[];
    /** Index definitions */
    indexes?: DataIndex[];
    /** Semantic categorization for AI understanding */
    semantic_type?: DataTableSemanticType;
    /** Tags for organization */
    tags: string[];
    /** Current row count (updated after imports) */
    row_count?: number;
    /** Table creation timestamp */
    created_at?: string;
    /** Last modification timestamp */
    updated_at?: string;
}

/**
 * Summary view of a data table (for listings).
 */
export interface DataTableSummary {
    /** Table name */
    name: string;
    /** Human-readable description */
    description?: string;
    /** Semantic categorization for AI understanding */
    semantic_type?: DataTableSemanticType;
    /** Number of columns */
    column_count: number;
    /** Current row count */
    row_count?: number;
    /** Tags for organization */
    tags: string[];
}

/**
 * Relationship type between tables.
 */
export type DataRelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-many';

/**
 * Semantic relationship between tables for AI understanding.
 */
export interface DataRelationship {
    /** Relationship name */
    name: string;
    /** Source table */
    from_table: string;
    /** Source column */
    from_column: string;
    /** Target table */
    to_table: string;
    /** Target column */
    to_column: string;
    /** Relationship cardinality */
    relationship_type: DataRelationshipType;
    /** Human-readable description */
    description?: string;
}

/**
 * Complete schema definition for a data store.
 */
export interface DataSchema {
    /** Semantic version (e.g., "1.2.0") */
    version: string;
    /** Schema description */
    description?: string;
    /** Table definitions */
    tables: DataTable[];
    /** Relationship definitions */
    relationships: DataRelationship[];
    /** Last update timestamp */
    updated_at: string;
    /** User/agent who last updated */
    updated_by?: string;
}

// ============================================================================
// Data Store Types
// ============================================================================

/**
 * Data store lifecycle status.
 */
export enum DataStoreStatus {
    /** Store is being created */
    CREATING = 'creating',
    /** Store is active and usable */
    ACTIVE = 'active',
    /** Store encountered an error */
    ERROR = 'error',
    /** Store has been archived (soft deleted) */
    ARCHIVED = 'archived',
}

/**
 * Summary view of a data store (for listings).
 */
export interface DataStoreItem extends BaseObject {
    /** Current status */
    status: DataStoreStatus;
    /** Current schema version */
    schema_version: string;
    /** Number of tables */
    table_count: number;
    /** Total rows across all tables */
    total_rows: number;
    /** Storage size in bytes */
    storage_bytes: number;
    /** Last import timestamp */
    last_import_at?: string;
    /** Number of versions stored */
    version_count: number;
    /** Tags for organization */
    tags: string[];
}

/**
 * Full data store with schema details.
 */
export interface DataStore extends DataStoreItem {
    /** Complete schema definition */
    schema: DataSchema;
    /** GCS bucket name */
    gcs_bucket: string;
    /** Path prefix within the bucket */
    gcs_path: string;
}

// ============================================================================
// Version Types
// ============================================================================

/**
 * Table state within a version.
 */
export interface DataStoreVersionTableState {
    /** Row count at this version */
    row_count: number;
    /** Content checksum */
    checksum: string;
}

/**
 * A point-in-time version of a data store.
 */
export interface DataStoreVersion {
    /** Version ID */
    id: string;
    /** Parent store ID */
    store_id: string;
    /** Commit message */
    message: string;
    /** Schema version at this point */
    schema_version: string;
    /** Table states at this version */
    tables: Record<string, DataStoreVersionTableState>;
    /** Creation timestamp */
    created_at: string;
    /** User/agent who created */
    created_by?: string;
    /** GCS object generation number */
    gcs_generation: number;
    /** Timestamp-based ID used for GCS path (internal) */
    gcs_path_id?: string;
    /** Whether this is a named snapshot */
    is_snapshot?: boolean;
    /** Snapshot name (if is_snapshot) */
    snapshot_name?: string;
}

// ============================================================================
// Import Types
// ============================================================================

/**
 * Import job status.
 */
export enum ImportStatus {
    /** Job is queued */
    PENDING = 'pending',
    /** Job is running */
    PROCESSING = 'processing',
    /** Job completed successfully */
    COMPLETED = 'completed',
    /** Job failed */
    FAILED = 'failed',
    /** Job was rolled back */
    ROLLED_BACK = 'rolled_back',
}

/**
 * Import job tracking.
 */
export interface ImportJob {
    /** Job ID */
    id: string;
    /** Parent store ID */
    store_id: string;
    /** Current status */
    status: ImportStatus;
    /** Tables being imported */
    tables: string[];
    /** Import mode */
    mode: 'append' | 'replace';
    /** Commit message */
    message?: string;
    /** Error message (if failed) */
    error?: string;
    /** Total rows imported */
    rows_imported: number;
    /** Job start timestamp */
    started_at: string;
    /** Job completion timestamp */
    completed_at?: string;
    /** Resulting version ID (if completed) */
    version_id?: string;
    /** User/agent who initiated */
    created_by?: string;
}

// ============================================================================
// API Payloads
// ============================================================================

/**
 * Payload for creating a new data store.
 */
export interface CreateDataStorePayload {
    /** Store name (unique within project) */
    name: string;
    /** Store description */
    description?: string;
    /** Tags for organization */
    tags?: string[];
}

/**
 * Payload for creating a new table.
 */
export interface CreateTablePayload {
    /** Table name */
    name: string;
    /** Table description */
    description?: string;
    /** Column definitions (at least one required) */
    columns: DataColumn[];
    /** Foreign key constraints */
    foreign_keys?: DataForeignKey[];
    /** Index definitions */
    indexes?: DataIndex[];
    /** Semantic type */
    semantic_type?: DataTableSemanticType;
    /** Tags */
    tags?: string[];
}

/**
 * Payload for creating multiple tables atomically.
 */
export interface CreateTablesPayload {
    /** Table definitions to create */
    tables: CreateTablePayload[];
    /** Commit message */
    message: string;
}

/**
 * Schema change operation types.
 */
export type AlterTableOperation =
    | { op: 'add_column'; column: DataColumn }
    | { op: 'drop_column'; column: string }
    | { op: 'rename_column'; from: string; to: string }
    | { op: 'modify_column'; column: string; updates: Partial<Omit<DataColumn, 'name'>> };

/**
 * Payload for altering a table schema.
 */
export interface AlterTablePayload {
    /** List of schema changes to apply */
    changes: AlterTableOperation[];
}

/**
 * Payload for AI-driven bulk schema updates.
 */
export interface UpdateSchemaPayload {
    /** Updated schema description */
    description?: string;
    /** Tables to create or update */
    tables?: CreateTablePayload[];
    /** Relationships to set */
    relationships?: DataRelationship[];
    /** Tables to drop */
    drop_tables?: string[];
    /** Commit message (required) */
    message: string;
}

/**
 * Data source for import.
 * - 'inline': data provided directly in the payload
 * - 'gcs': data in Google Cloud Storage (gs://bucket/path)
 * - 'url': data at an HTTPS URL
 * - 'artifact': data from workflow artifact (resolved to GCS by tool)
 */
export type ImportDataSource = 'inline' | 'gcs' | 'url' | 'artifact';

/**
 * Data format for external sources.
 */
export type ImportDataFormat = 'json' | 'csv' | 'parquet';

/**
 * Table data specification for import.
 */
export interface ImportTableData {
    /** Where the data comes from */
    source: ImportDataSource;
    /** Inline data (when source is 'inline') */
    data?: Record<string, unknown>[];
    /** URI for external data (gcs: gs://..., url: https://..., artifact: out/file.csv) */
    uri?: string;
    /** Data format for external sources */
    format?: ImportDataFormat;
}

/**
 * Payload for importing data into tables.
 */
export interface ImportDataPayload {
    /** Map of table name to data specification */
    tables: Record<string, ImportTableData>;
    /** Import mode */
    mode: 'append' | 'replace';
    /** Commit message */
    message: string;
}

/**
 * Payload for creating a named snapshot.
 */
export interface CreateSnapshotPayload {
    /** Snapshot name (must be unique within store) */
    name: string;
    /** Snapshot description */
    message: string;
}

/**
 * Payload for executing a query.
 */
export interface QueryPayload {
    /** SQL query (SELECT only) */
    sql: string;
    /** Query parameters (for prepared statements) */
    params?: Record<string, unknown>;
    /** Maximum rows to return */
    limit?: number;
    /** Query against a specific version (optional) */
    version_id?: string;
}

/**
 * Column metadata in query results.
 */
export interface QueryResultColumn {
    /** Column name */
    name: string;
    /** Column type */
    type: string;
}

/**
 * Query execution result.
 */
export interface QueryResult {
    /** Column metadata */
    columns: QueryResultColumn[];
    /** Result rows */
    rows: Record<string, unknown>[];
    /** Number of rows returned */
    row_count: number;
    /** Query execution time in milliseconds */
    execution_time_ms: number;
    /** Error message if query failed (used in batch queries) */
    error?: string;
}

// ============================================================================
// AI Agent Interface
// ============================================================================

/**
 * Simplified column representation for AI agents.
 */
export interface DataColumnForAI {
    /** Data type */
    type: DataColumnType;
    /** Description */
    description?: string;
    /** Semantic type */
    semantic_type?: SemanticColumnType;
    /** Whether nullable */
    nullable: boolean;
    /** Whether primary key */
    primary_key: boolean;
    /** Example values */
    examples?: string[];
}

/**
 * Simplified foreign key representation for AI agents.
 */
export interface DataForeignKeyForAI {
    /** Column name */
    column: string;
    /** Reference in "table.column" format */
    references: string;
}

/**
 * Simplified table representation for AI agents.
 */
export interface DataTableForAI {
    /** Description */
    description?: string;
    /** Semantic type */
    semantic_type?: DataTableSemanticType;
    /** Columns by name */
    columns: Record<string, DataColumnForAI>;
    /** Foreign keys */
    foreign_keys: DataForeignKeyForAI[];
}

/**
 * Simplified relationship representation for AI agents.
 */
export interface DataRelationshipForAI {
    /** Relationship name */
    name: string;
    /** Source in "table.column" format */
    from: string;
    /** Target in "table.column" format */
    to: string;
    /** Relationship type */
    type: DataRelationshipType;
    /** Description */
    description?: string;
}

/**
 * Simplified schema representation optimized for AI agent consumption.
 * Provides semantic context for understanding the data model.
 */
export interface DataSchemaForAI {
    /** Store name */
    name: string;
    /** Schema version */
    version: string;
    /** Schema description */
    description?: string;
    /** Tables by name */
    tables: Record<string, DataTableForAI>;
    /** Relationships */
    relationships: DataRelationshipForAI[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Version retention configuration.
 */
export interface DataStoreRetentionConfig {
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
export enum DashboardStatus {
    /** Dashboard is active and usable */
    ACTIVE = 'active',
    /** Dashboard has been archived (soft deleted) */
    ARCHIVED = 'archived',
}

/**
 * Named SQL query that maps to a Vega data source.
 * Supports parameterized SQL with {{param_name}} placeholders.
 */
export interface DashboardQuery {
    /** Query name (used as data source reference in Vega specs) */
    name: string;
    /** SQL query (SELECT only). Can include {{param_name}} placeholders for dynamic values. */
    sql: string;
    /** Human-readable description */
    description?: string;
    /** Maximum rows to return */
    limit?: number;
    /** Default values for SQL parameters. Keys are parameter names (without braces). */
    parameters?: Record<string, string>;
}

/**
 * Panel position within the dashboard grid.
 */
export interface DashboardPanelPosition {
    /** Row index (0-based) */
    row: number;
    /** Column index (0-based) */
    col: number;
    /** Width in grid cells (default: 1) */
    width?: number;
    /** Height in grid cells (default: 1) */
    height?: number;
}

/**
 * Dashboard panel with Vega/Vega-Lite visualization.
 */
export interface DashboardPanel {
    /** Panel ID (auto-generated if not provided) */
    id?: string;
    /** Panel title */
    title: string;
    /** Vega or Vega-Lite specification */
    spec: Record<string, unknown>;
    /** Whether spec is Vega-Lite (default: true) */
    vegaLite?: boolean;
    /** Query names that populate this panel's data sources */
    dataSources: string[];
    /** Position in the dashboard grid */
    position: DashboardPanelPosition;
}

/**
 * Dashboard layout configuration.
 */
export interface DashboardLayout {
    /** Number of columns in the grid (default: 2) */
    columns: number;
    /** Width of each cell in pixels (default: 600) */
    cellWidth: number;
    /** Height of each cell in pixels (default: 400) */
    cellHeight: number;
    /** Padding between cells in pixels (default: 20) */
    padding: number;
}

/**
 * Default layout configuration for dashboards.
 */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
    columns: 2,
    cellWidth: 600,
    cellHeight: 400,
    padding: 20,
};

/**
 * Summary view of a dashboard (for listings).
 */
export interface DashboardItem extends BaseObject {
    /** Parent data store ID */
    store_id: string;
    /** Current status */
    status: DashboardStatus;
    /** Number of panels */
    panel_count: number;
    /** Number of queries */
    query_count: number;
    /** Last render timestamp */
    last_rendered_at?: string;
    /** Tags for organization */
    tags: string[];
}

/**
 * Full dashboard with queries, panels, and layout.
 */
export interface Dashboard extends DashboardItem {
    /** Named SQL queries */
    queries: DashboardQuery[];
    /** Panel definitions */
    panels: DashboardPanel[];
    /** Layout configuration */
    layout: DashboardLayout;
    /** URL of last rendered image */
    last_render_url?: string;
}

/**
 * Payload for creating a new dashboard.
 */
export interface CreateDashboardPayload {
    /** Dashboard name (unique within store) */
    name: string;
    /** Dashboard description */
    description?: string;
    /** Named SQL queries */
    queries: DashboardQuery[];
    /** Panel definitions */
    panels: DashboardPanel[];
    /** Layout configuration (uses defaults if not provided) */
    layout?: Partial<DashboardLayout>;
}

/**
 * Payload for updating a dashboard.
 */
export interface UpdateDashboardPayload {
    /** Dashboard name */
    name?: string;
    /** Dashboard description */
    description?: string;
    /** Named SQL queries */
    queries?: DashboardQuery[];
    /** Panel definitions */
    panels?: DashboardPanel[];
    /** Layout configuration */
    layout?: Partial<DashboardLayout>;
    /** Skip auto-version creation. Use when doing iterative work. */
    skip_versioning?: boolean;
}

/**
 * Payload for previewing a dashboard (render without saving).
 */
export interface PreviewDashboardPayload {
    /** Named SQL queries */
    queries: DashboardQuery[];
    /** Panel definitions */
    panels: DashboardPanel[];
    /** Layout configuration (uses defaults if not provided) */
    layout?: Partial<DashboardLayout>;
}

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

/**
 * Result of rendering a dashboard.
 */
export interface RenderDashboardResult {
    /** URL to the rendered PNG image */
    url: string;
    /** When the URL expires (seconds from now) */
    expires_in: number;
    /** When the dashboard was rendered */
    rendered_at: string;
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
}

// ============================================================================
// Dashboard Version Types
// ============================================================================

/**
 * A point-in-time version of a dashboard.
 * Stores full snapshot inline (no external storage needed for small JSON documents).
 */
export interface DashboardVersion {
    /** Version ID */
    id: string;
    /** Parent dashboard ID */
    dashboard_id: string;
    /** Version number (auto-incremented) */
    version_number: number;
    /** Commit message describing the change */
    message: string;
    /** Snapshot of queries at this version */
    queries: DashboardQuery[];
    /** Snapshot of panels at this version */
    panels: DashboardPanel[];
    /** Snapshot of layout at this version */
    layout: DashboardLayout;
    /** Whether this is the currently active/displayed version */
    is_current: boolean;
    /** Whether this is a named snapshot (protected from TTL cleanup) */
    is_snapshot: boolean;
    /** Snapshot name (if is_snapshot) */
    snapshot_name?: string;
    /** Creation timestamp */
    created_at: string;
    /** User/agent who created this version */
    created_by?: string;
}

/**
 * Summary view of a dashboard version (for listings).
 */
export interface DashboardVersionItem {
    /** Version ID */
    id: string;
    /** Parent dashboard ID */
    dashboard_id: string;
    /** Version number */
    version_number: number;
    /** Commit message */
    message: string;
    /** Whether this is the current version */
    is_current: boolean;
    /** Whether this is a named snapshot */
    is_snapshot: boolean;
    /** Snapshot name (if is_snapshot) */
    snapshot_name?: string;
    /** Number of panels in this version */
    panel_count: number;
    /** Number of queries in this version */
    query_count: number;
    /** Creation timestamp */
    created_at: string;
    /** User/agent who created */
    created_by?: string;
}

/**
 * Payload for creating a named snapshot.
 */
export interface CreateDashboardSnapshotPayload {
    /** Snapshot name (must be unique within dashboard) */
    name: string;
    /** Snapshot description/message */
    message: string;
}

/**
 * Payload for promoting a version to current.
 */
export interface PromoteDashboardVersionPayload {
    /** Commit message for the promotion */
    message?: string;
}
