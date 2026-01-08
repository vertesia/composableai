import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    AlterTablePayload,
    CreateDataStorePayload,
    CreateSnapshotPayload,
    CreateTablePayload,
    DataSchema,
    DataSchemaForAI,
    DataStore,
    DataStoreItem,
    DataStoreVersion,
    DataTable,
    DataTableSummary,
    ImportDataPayload,
    ImportJob,
    QueryPayload,
    QueryResult,
    UpdateSchemaPayload,
} from "@vertesia/common";
import { DashboardApi } from "./DashboardApi.js";

/**
 * Client API for managing versioned analytical data stores.
 *
 * Data stores provide DuckDB-powered analytical databases with:
 * - AI-manageable schemas
 * - Multi-table atomic imports
 * - Version history and rollback
 * - Named snapshots
 */
export class DataApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/data");
    }

    // ============================================================
    // Store Operations
    // ============================================================

    /**
     * List all data stores in the project.
     */
    list(): Promise<DataStoreItem[]> {
        return this.get("/");
    }

    /**
     * Create a new data store.
     *
     * @param payload - Store configuration including name and optional description
     * @returns The created data store
     *
     * @example
     * ```typescript
     * const store = await client.data.create({
     *   name: 'analytics',
     *   description: 'Customer analytics data'
     * });
     * ```
     */
    create(payload: CreateDataStorePayload): Promise<DataStore> {
        return this.post("/", { payload });
    }

    /**
     * Retrieve a data store by ID.
     *
     * @param id - Data store ID
     * @returns The data store with full details
     */
    retrieve(id: string): Promise<DataStore> {
        return this.get(`/${id}`);
    }

    /**
     * Archive (soft delete) a data store.
     *
     * The store data remains in GCS but is no longer accessible via API.
     *
     * @param id - Data store ID
     * @returns Object with the archived store ID
     */
    delete(id: string): Promise<{ id: string }> {
        return this.del(`/${id}`);
    }

    // ============================================================
    // Schema Operations
    // ============================================================

    /**
     * Get the schema of a data store.
     *
     * @param id - Data store ID
     * @param format - Optional format: 'ai' returns AI-friendly simplified schema
     * @returns The schema (full or AI-friendly format)
     *
     * @example
     * ```typescript
     * // Get full schema
     * const schema = await client.data.getSchema(storeId);
     *
     * // Get AI-friendly schema for agent context
     * const aiSchema = await client.data.getSchema(storeId, 'ai');
     * ```
     */
    getSchema(id: string, format?: 'ai'): Promise<DataSchema | DataSchemaForAI> {
        const query = format ? `?format=${format}` : '';
        return this.get(`/${id}/schema${query}`);
    }

    /**
     * Update the schema of a data store.
     *
     * Use this for AI-driven schema evolution. The schema version is automatically
     * incremented based on the type of change (major, minor, patch).
     *
     * @param id - Data store ID
     * @param payload - Schema update payload with bump type
     * @returns The updated schema
     */
    updateSchema(id: string, payload: UpdateSchemaPayload): Promise<DataSchema> {
        return this.put(`/${id}/schema`, { payload });
    }

    /**
     * Get the schema version history of a data store.
     *
     * @param id - Data store ID
     * @returns List of schema versions with timestamps
     */
    getSchemaHistory(id: string): Promise<DataStoreVersion[]> {
        return this.get(`/${id}/schema/history`);
    }

    // ============================================================
    // Table Operations
    // ============================================================

    /**
     * List all tables in a data store.
     *
     * @param id - Data store ID
     * @returns List of table summaries with metadata
     */
    listTables(id: string): Promise<DataTableSummary[]> {
        return this.get(`/${id}/tables`);
    }

    /**
     * Create a new table in a data store.
     *
     * @param id - Data store ID
     * @param payload - Table definition including columns, indexes, etc.
     * @returns The created table
     *
     * @example
     * ```typescript
     * const table = await client.data.createTable(storeId, {
     *   name: 'customers',
     *   columns: [
     *     { name: 'id', type: 'INTEGER', primaryKey: true },
     *     { name: 'email', type: 'STRING', semanticType: 'email' },
     *     { name: 'revenue', type: 'DECIMAL', semanticType: 'currency' }
     *   ]
     * });
     * ```
     */
    createTable(id: string, payload: CreateTablePayload): Promise<DataTable> {
        return this.post(`/${id}/tables`, { payload });
    }

    /**
     * Get a table by name.
     *
     * @param id - Data store ID
     * @param tableName - Table name
     * @param sample - If true, includes sample rows
     * @returns The table with metadata and optional sample data
     */
    getTable(id: string, tableName: string, sample?: boolean): Promise<DataTable & { sampleRows?: Record<string, unknown>[] }> {
        const query = sample ? '?sample=true' : '';
        return this.get(`/${id}/tables/${tableName}${query}`);
    }

    /**
     * Alter a table schema.
     *
     * @param id - Data store ID
     * @param tableName - Table name
     * @param payload - Changes to apply (add/drop/modify columns, etc.)
     * @returns The updated table
     */
    alterTable(id: string, tableName: string, payload: AlterTablePayload): Promise<DataTable> {
        return this.put(`/${id}/tables/${tableName}`, { payload });
    }

    /**
     * Drop a table from the data store.
     *
     * @param id - Data store ID
     * @param tableName - Table name
     */
    dropTable(id: string, tableName: string): Promise<void> {
        return this.del(`/${id}/tables/${tableName}`);
    }

    // ============================================================
    // Import Operations
    // ============================================================

    /**
     * Import data into one or more tables atomically.
     *
     * If any table import fails, the entire operation is rolled back.
     * Creates a version snapshot before the import for recovery.
     *
     * @param id - Data store ID
     * @param payload - Import configuration with tables and data
     * @returns Import job with status
     *
     * @example
     * ```typescript
     * const job = await client.data.import(storeId, {
     *   mode: 'append',
     *   message: 'Monthly data import',
     *   tables: {
     *     customers: {
     *       source: 'gs://bucket/customers.csv',
     *       format: 'csv'
     *     },
     *     orders: {
     *       data: [
     *         { id: 1, customer_id: 1, amount: 99.99 }
     *       ]
     *     }
     *   }
     * });
     * ```
     */
    import(id: string, payload: ImportDataPayload): Promise<ImportJob> {
        return this.post(`/${id}/import`, { payload });
    }

    /**
     * Get the status of an import job.
     *
     * @param id - Data store ID
     * @param importId - Import job ID
     * @returns Import job status
     */
    getImportStatus(id: string, importId: string): Promise<ImportJob> {
        return this.get(`/${id}/import/${importId}`);
    }

    // ============================================================
    // Version Operations
    // ============================================================

    /**
     * List versions of a data store.
     *
     * @param id - Data store ID
     * @param snapshotsOnly - If true, only returns named snapshots
     * @returns List of versions
     */
    listVersions(id: string, snapshotsOnly?: boolean): Promise<DataStoreVersion[]> {
        const query = snapshotsOnly ? '?snapshots=true' : '';
        return this.get(`/${id}/versions${query}`);
    }

    /**
     * Create a named snapshot of the current state.
     *
     * Named snapshots are kept indefinitely (not subject to 30-day cleanup).
     *
     * @param id - Data store ID
     * @param payload - Snapshot name and optional message
     * @returns The created version/snapshot
     *
     * @example
     * ```typescript
     * const snapshot = await client.data.createSnapshot(storeId, {
     *   name: 'before-migration',
     *   message: 'Snapshot before major schema change'
     * });
     * ```
     */
    createSnapshot(id: string, payload: CreateSnapshotPayload): Promise<DataStoreVersion> {
        return this.post(`/${id}/versions`, { payload });
    }

    /**
     * Rollback to a previous version.
     *
     * Creates a new version that is a copy of the target version.
     *
     * @param id - Data store ID
     * @param versionId - Version ID to rollback to
     * @returns The updated data store
     */
    rollback(id: string, versionId: string): Promise<DataStore> {
        return this.post(`/${id}/versions/${versionId}/rollback`, {});
    }

    /**
     * Query a specific version or snapshot without rolling back.
     *
     * Useful for migrations: read data from old schema format to transform it.
     *
     * @param id - Data store ID
     * @param versionId - Version ID or snapshot ID to query
     * @param payload - Query configuration
     * @returns Query results from the version
     *
     * @example
     * ```typescript
     * // Create snapshot before migration
     * const snapshot = await client.data.createSnapshot(storeId, {
     *   name: 'pre-migration',
     *   message: 'Before name split migration'
     * });
     *
     * // Query old data from snapshot
     * const oldData = await client.data.queryVersion(storeId, snapshot.id, {
     *   sql: 'SELECT id, full_name, email FROM customers'
     * });
     *
     * // Transform and import with new schema...
     * ```
     */
    queryVersion(id: string, versionId: string, payload: QueryPayload): Promise<QueryResult> {
        return this.post(`/${id}/versions/${versionId}/query`, { payload });
    }

    // ============================================================
    // Query Operations
    // ============================================================

    /**
     * Execute a read-only SQL query against the data store.
     *
     * @param id - Data store ID
     * @param payload - Query configuration
     * @returns Query results
     *
     * @example
     * ```typescript
     * const result = await client.data.query(storeId, {
     *   sql: 'SELECT customer_id, SUM(amount) as total FROM orders GROUP BY customer_id',
     *   limit: 100
     * });
     * console.log(result.rows);
     * ```
     */
    query(id: string, payload: QueryPayload): Promise<QueryResult> {
        return this.post(`/${id}/query`, { payload });
    }

    // ============================================================
    // Download Operations (for sandbox sync)
    // ============================================================

    /**
     * Get a signed download URL for the database file.
     *
     * Used by sandbox to sync databases for native DuckDB access.
     * Returns signed URL + gcs_generation for cache validation.
     *
     * @param id - Data store ID
     * @param versionId - Optional: specific version/snapshot ID (default: latest)
     * @returns Download info with signed URL and cache validation data
     *
     * @example
     * ```typescript
     * const info = await client.data.getDownloadInfo(storeId);
     * // Download if gcs_generation changed
     * if (info.gcs_generation !== localGeneration) {
     *   await downloadFile(info.url, '/home/daytona/databases/store.duckdb');
     * }
     * ```
     */
    getDownloadInfo(id: string, versionId?: string): Promise<DataStoreDownloadInfo> {
        const query = versionId ? `?version_id=${versionId}` : '';
        return this.get(`/${id}/download${query}`);
    }

    // ============================================================
    // Dashboard Operations
    // ============================================================

    /**
     * Get the Dashboard API for a specific data store.
     *
     * @param storeId - Data store ID
     * @returns DashboardApi instance for managing dashboards
     *
     * @example
     * ```typescript
     * // List dashboards
     * const dashboards = await client.data.dashboards(storeId).list();
     *
     * // Preview a dashboard before creating
     * const preview = await client.data.dashboards(storeId).preview({
     *   queries: [{ name: 'sales', sql: 'SELECT * FROM sales' }],
     *   panels: [{ title: 'Sales', dataSources: ['sales'], ... }]
     * });
     *
     * // Create a dashboard
     * const dashboard = await client.data.dashboards(storeId).create({
     *   name: 'Sales Overview',
     *   queries: [...],
     *   panels: [...]
     * });
     *
     * // Render dashboard to PNG
     * const result = await client.data.dashboards(storeId).render(dashboardId);
     * ```
     */
    dashboards(storeId: string): DashboardApi {
        return new DashboardApi(this.client, storeId);
    }
}

/**
 * Response from the download endpoint.
 */
export interface DataStoreDownloadInfo {
    /** Signed download URL (expires in 15 min) */
    url: string;
    /** GCS generation number for cache validation */
    gcs_generation: number;
    /** Schema version */
    schema_version: string;
    /** Store ID */
    store_id: string;
    /** Store name */
    store_name: string;
    /** List of table names */
    tables: string[];
    /** URL expiry time in seconds */
    expires_in: number;
}
