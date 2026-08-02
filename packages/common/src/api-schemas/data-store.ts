import { z } from 'zod';
import { DataColumnType, DataStoreStatus, ImportStatus, SemanticColumnType } from '../data-platform.js';
import { NumberValueMapSchema } from './interaction.js';

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const QueryValidationErrorSchema = z
    .strictObject({
        query: z.string(),
        error: z.string(),
    })
    .meta({ id: 'QueryValidationError' });

export const ListDataStoreVersionsQuerySchema = z
    .strictObject({
        limit: z.number().optional(),
        snapshots_only: z.boolean().optional(),
    })
    .meta({ id: 'ListDataStoreVersionsQuery' });

export const GetDataStoreTableQuerySchema = z
    .strictObject({
        sample: z.boolean().optional(),
    })
    .meta({ id: 'GetDataStoreTableQuery' });

export const QueryValidationPayloadSchema = z
    .strictObject({
        queries: z.array(
            z.strictObject({
                name: z.string(),
                sql: z.string(),
            }),
        ),
    })
    .meta({ id: 'QueryValidationPayload' });

export const DataTableSemanticTypeSchema = z
    .enum(['dimension', 'fact', 'bridge', 'staging'])
    .meta({ id: 'DataTableSemanticType', description: 'Semantic type categorization for tables.' });

export const DataIndexSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Index name' }),
        columns: z.array(z.string()).meta({ description: 'Columns included in the index' }),
        unique: z.boolean().meta({ description: 'Whether the index enforces uniqueness' }).optional(),
    })
    .meta({ id: 'DataIndex', description: 'Index definition for a table.' });

export const DataForeignKeySchema = z
    .strictObject({
        column: z.string().meta({ description: 'Column in this table' }),
        references_table: z.string().meta({ description: 'Referenced table name' }),
        references_column: z.string().meta({ description: 'Referenced column name' }),
        on_delete: z.enum(['CASCADE', 'SET NULL', 'NO ACTION']).meta({ description: 'Action on delete' }).optional(),
    })
    .meta({ id: 'DataForeignKey', description: 'Foreign key constraint definition.' });

export const SemanticColumnTypeSchema = z.enum(SemanticColumnType).meta({
    id: 'SemanticColumnType',
    description: 'Semantic types that provide AI agents with context about column meaning.',
});

export const DataColumnTypeSchema = z
    .enum(DataColumnType)
    .meta({ id: 'DataColumnType', description: 'Supported column data types for DuckDB tables.' });

export const Partial_Omit_DataColumn_nameSchema = z
    .strictObject({
        type: DataColumnTypeSchema.meta({ description: 'Data type' }).optional(),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        nullable: z.boolean().meta({ description: 'Whether the column allows NULL values' }).optional(),
        default: z.string().meta({ description: 'Default value (SQL expression as string)' }).optional(),
        primary_key: z.boolean().meta({ description: 'Whether this is the primary key' }).optional(),
        auto_increment: z
            .boolean()
            .meta({ description: 'Whether this column should use a sequence-backed auto-increment default' })
            .optional(),
        unique: z.boolean().meta({ description: 'Whether values must be unique' }).optional(),
        semantic_type: SemanticColumnTypeSchema.meta({ description: 'Semantic type for AI understanding' }).optional(),
        examples: z.array(z.string()).meta({ description: 'Example values for AI context' }).optional(),
    })
    .meta({ id: 'Partial_Omit_DataColumn_name' });

export const DataRelationshipTypeSchema = z
    .enum(['one-to-one', 'one-to-many', 'many-to-many'])
    .meta({ id: 'DataRelationshipType', description: 'Relationship type between tables.' });

export const QueryResultColumnSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Column name' }),
        type: z.string().meta({ description: 'Column type' }),
    })
    .meta({ id: 'QueryResultColumn', description: 'Column metadata in query results.' });

export const BatchQueryPayloadSchema = z
    .strictObject({
        queries: z.array(
            z.strictObject({
                name: z.string(),
                sql: z.string(),
                limit: z.number().optional(),
            }),
        ),
    })
    .meta({ id: 'BatchQueryPayload' });

export const QueryResultSchema = z
    .strictObject({
        columns: z.array(QueryResultColumnSchema).meta({ description: 'Column metadata' }),
        rows: z.array(z.looseObject({})).meta({ description: 'Result rows' }),
        row_count: z.number().meta({ description: 'Number of rows returned' }),
        execution_time_ms: z.number().meta({ description: 'Query execution time in milliseconds' }),
        error: z.string().meta({ description: 'Error message if query failed (used in batch queries)' }).optional(),
    })
    .meta({ id: 'QueryResult', description: 'Query execution result.' });

export const QueryPayloadSchema = z
    .strictObject({
        sql: z.string().meta({ description: 'SQL query (SELECT only)' }),
        params: z.looseObject({}).meta({ description: 'Query parameters (for prepared statements)' }).optional(),
        limit: z.number().meta({ description: 'Maximum rows to return' }).optional(),
        version_id: z.string().meta({ description: 'Query against a specific version (optional)' }).optional(),
    })
    .meta({ id: 'QueryPayload', description: 'Payload for executing a query.' });

export const DataStoreMutateRowsResultSchema = z
    .strictObject({
        version_id: z.string().meta({ description: 'Resulting data store version ID' }),
        affected_tables: z.array(z.string()).meta({ description: 'Tables affected by the statement' }),
        row_counts: NumberValueMapSchema.meta({
            description: 'Current row counts for affected tables after the mutation',
        }),
        execution_time_ms: z.number().meta({ description: 'Statement execution time in milliseconds' }),
    })
    .meta({ id: 'DataStoreMutateRowsResult', description: 'Result from mutating rows in a data store.' });

export const DataStoreMutateRowsPayloadSchema = z
    .strictObject({
        sql: z.string().meta({ description: 'SQL statement. Only UPDATE and DELETE statements are accepted.' }),
        message: z.string().meta({ description: 'Commit message recorded on the resulting data store version.' }),
        allow_full_table: z
            .boolean()
            .meta({ description: 'Allow UPDATE/DELETE statements without a WHERE clause. Defaults to false.' })
            .optional(),
    })
    .meta({
        id: 'DataStoreMutateRowsPayload',
        description: 'Payload for mutating data rows with a single SQL statement.',
    });

export const DataTableSummarySchema = z
    .strictObject({
        name: z.string().meta({ description: 'Table name' }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        semantic_type: DataTableSemanticTypeSchema.meta({
            description: 'Semantic categorization for AI understanding',
        }).optional(),
        column_count: z.number().meta({ description: 'Number of columns' }),
        row_count: z.number().meta({ description: 'Current row count' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
    })
    .meta({ id: 'DataTableSummary', description: 'Summary view of a data table (for listings).' });

export const DataStoreVersionTableStateSchema = z
    .strictObject({
        row_count: z.number().meta({ description: 'Row count at this version' }),
        checksum: z.string().meta({ description: 'Content checksum' }),
    })
    .meta({ id: 'DataStoreVersionTableState', description: 'Table state within a version.' });

export const DataStoreStatusSchema = z
    .enum(DataStoreStatus)
    .meta({ id: 'DataStoreStatus', description: 'Data store lifecycle status.' });

export const ImportDataFormatSchema = z
    .enum(['json', 'csv', 'parquet'])
    .meta({ id: 'ImportDataFormat', description: 'Data format for external sources.' });

export const ImportDataSourceSchema = z.enum(['inline', 'gcs', 'url', 'artifact']).meta({
    id: 'ImportDataSource',
    description:
        "Data source for import.\n- 'inline': data provided directly in the payload\n- 'gcs': data in Google Cloud Storage (gs://bucket/path)\n- 'url': data at an HTTPS URL\n- 'artifact': data from workflow artifact (resolved to GCS by tool)",
});

export const DataRelationshipForAISchema = z
    .strictObject({
        name: z.string().meta({ description: 'Relationship name' }),
        from: z.string().meta({ description: 'Source in "table.column" format' }),
        to: z.string().meta({ description: 'Target in "table.column" format' }),
        type: DataRelationshipTypeSchema.meta({ description: 'Relationship type' }),
        description: z.string().meta({ description: 'Description' }).optional(),
    })
    .meta({ id: 'DataRelationshipForAI', description: 'Simplified relationship representation for AI agents.' });

export const DataForeignKeyForAISchema = z
    .strictObject({
        column: z.string().meta({ description: 'Column name' }),
        references: z.string().meta({ description: 'Reference in "table.column" format' }),
    })
    .meta({ id: 'DataForeignKeyForAI', description: 'Simplified foreign key representation for AI agents.' });

export const DataColumnForAISchema = z
    .strictObject({
        type: DataColumnTypeSchema.meta({ description: 'Data type' }),
        description: z.string().meta({ description: 'Description' }).optional(),
        semantic_type: SemanticColumnTypeSchema.meta({ description: 'Semantic type' }).optional(),
        nullable: z.boolean().meta({ description: 'Whether nullable' }),
        primary_key: z.boolean().meta({ description: 'Whether primary key' }),
        auto_increment: z.boolean().meta({ description: 'Whether sequence-backed auto-increment is enabled' }),
        examples: z.array(z.string()).meta({ description: 'Example values' }).optional(),
    })
    .meta({ id: 'DataColumnForAI', description: 'Simplified column representation for AI agents.' });

export const ImportStatusSchema = z.enum(ImportStatus).meta({ id: 'ImportStatus', description: 'Import job status.' });

export const DataStoreTableDropResultSchema = z
    .strictObject({
        dropped: z.string(),
    })
    .meta({ id: 'DataStoreTableDropResult' });

export const DataStoreArchiveResultSchema = z
    .strictObject({
        id: z.string(),
        status: DataStoreStatusSchema,
    })
    .meta({ id: 'DataStoreArchiveResult' });

export const CreateSnapshotPayloadSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Snapshot name (must be unique within store)' }),
        message: z.string().meta({ description: 'Snapshot description' }),
    })
    .meta({ id: 'CreateSnapshotPayload', description: 'Payload for creating a named snapshot.' });

export const DataStoreDownloadInfoSchema = z
    .strictObject({
        url: z.string(),
        gcs_generation: z.number(),
        schema_version: z.string(),
        store_id: z.string(),
        store_name: z.string(),
        tables: z.array(z.string()),
        expires_in: z.number(),
    })
    .meta({ id: 'DataStoreDownloadInfo' });

export const CreateDataStorePayloadSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Store name (unique within project)' }),
        description: z.string().meta({ description: 'Store description' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }).optional(),
    })
    .meta({ id: 'CreateDataStorePayload', description: 'Payload for creating a new data store.' });

export const QueryValidationResultSchema = z
    .strictObject({
        valid: z.boolean(),
        errors: z.array(QueryValidationErrorSchema),
    })
    .meta({ id: 'QueryValidationResult' });

export const DataColumnSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Column name (must be valid SQL identifier)' }),
        type: DataColumnTypeSchema.meta({ description: 'Data type' }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        nullable: z.boolean().meta({ description: 'Whether the column allows NULL values' }).optional(),
        default: z.string().meta({ description: 'Default value (SQL expression as string)' }).optional(),
        primary_key: z.boolean().meta({ description: 'Whether this is the primary key' }).optional(),
        auto_increment: z
            .boolean()
            .meta({ description: 'Whether this column should use a sequence-backed auto-increment default' })
            .optional(),
        unique: z.boolean().meta({ description: 'Whether values must be unique' }).optional(),
        semantic_type: SemanticColumnTypeSchema.meta({ description: 'Semantic type for AI understanding' }).optional(),
        examples: z.array(z.string()).meta({ description: 'Example values for AI context' }).optional(),
    })
    .meta({ id: 'DataColumn', description: 'Column definition for a data table.' });

export const AlterTableOperationSchema = z
    .discriminatedUnion('op', [
        z.strictObject({
            op: z.literal('add_column'),
            column: DataColumnSchema,
        }),
        z.strictObject({
            op: z.literal('drop_column'),
            column: z.string(),
        }),
        z.strictObject({
            op: z.literal('rename_column'),
            from: z.string(),
            to: z.string(),
        }),
        z.strictObject({
            op: z.literal('modify_column'),
            column: z.string(),
            updates: Partial_Omit_DataColumn_nameSchema,
        }),
    ])
    .meta({
        id: 'AlterTableOperation',
        type: 'object',
        discriminator: { propertyName: 'op' },
        required: ['op'],
    });

export const DataRelationshipSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Relationship name' }),
        from_table: z.string().meta({ description: 'Source table' }),
        from_column: z.string().meta({ description: 'Source column' }),
        to_table: z.string().meta({ description: 'Target table' }),
        to_column: z.string().meta({ description: 'Target column' }),
        relationship_type: DataRelationshipTypeSchema.meta({ description: 'Relationship cardinality' }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
    })
    .meta({ id: 'DataRelationship', description: 'Semantic relationship between tables for AI understanding.' });

export const CreateTablePayloadSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Table name' }),
        description: z.string().meta({ description: 'Table description' }).optional(),
        columns: z.array(DataColumnSchema).meta({ description: 'Column definitions (at least one required)' }),
        foreign_keys: z.array(DataForeignKeySchema).meta({ description: 'Foreign key constraints' }).optional(),
        indexes: z.array(DataIndexSchema).meta({ description: 'Index definitions' }).optional(),
        semantic_type: DataTableSemanticTypeSchema.meta({ description: 'Semantic type' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags' }).optional(),
    })
    .meta({ id: 'CreateTablePayload', description: 'Payload for creating a new table.' });

export const BatchQueryResultItemSchema = z
    .strictObject({
        columns: z.array(QueryResultColumnSchema).meta({ description: 'Column metadata' }),
        rows: z.array(z.looseObject({})).meta({ description: 'Result rows' }),
        row_count: z.number().meta({ description: 'Number of rows returned' }),
        execution_time_ms: z.number().meta({ description: 'Query execution time in milliseconds' }),
        error: z.string().meta({ description: 'Error message if query failed (used in batch queries)' }).optional(),
        name: z.string(),
    })
    .meta({ id: 'BatchQueryResultItem' });

export const DataTableSummaryArraySchema = z.array(DataTableSummarySchema).meta({ id: 'DataTableSummaryArray' });

export const DataStoreVersionTableStateMapSchema = z
    .object({})
    .catchall(DataStoreVersionTableStateSchema)
    .meta({ id: 'DataStoreVersionTableStateMap' });

export const DataStoreItemSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        status: DataStoreStatusSchema.meta({ description: 'Current status' }),
        schema_version: z.string().meta({ description: 'Current schema version' }),
        table_count: z.number().meta({ description: 'Number of tables' }),
        total_rows: z.number().meta({ description: 'Total rows across all tables' }),
        storage_bytes: z.number().meta({ description: 'Storage size in bytes' }),
        last_import_at: z.string().meta({ description: 'Last import timestamp' }).optional(),
        version_count: z.number().meta({ description: 'Number of versions stored' }),
    })
    .meta({ id: 'DataStoreItem', description: 'Summary view of a data store (for listings).' });

export const ImportTableDataSchema = z
    .strictObject({
        source: ImportDataSourceSchema.meta({ description: 'Where the data comes from' }),
        data: z.array(z.looseObject({})).meta({ description: "Inline data (when source is 'inline')" }).optional(),
        uri: z
            .string()
            .meta({ description: 'URI for external data (gcs: gs://..., url: https://..., artifact: out/file.csv)' })
            .optional(),
        format: ImportDataFormatSchema.meta({ description: 'Data format for external sources' }).optional(),
    })
    .meta({ id: 'ImportTableData', description: 'Table data specification for import.' });

export const DataStoreTableDetailSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Table name (must be valid SQL identifier)' }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        columns: z.array(DataColumnSchema).meta({ description: 'Column definitions' }),
        foreign_keys: z.array(DataForeignKeySchema).meta({ description: 'Foreign key constraints' }).optional(),
        indexes: z.array(DataIndexSchema).meta({ description: 'Index definitions' }).optional(),
        semantic_type: DataTableSemanticTypeSchema.meta({
            description: 'Semantic categorization for AI understanding',
        }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
        row_count: z.number().meta({ description: 'Current row count (updated after imports)' }).optional(),
        created_at: z.string().meta({ description: 'Table creation timestamp' }).optional(),
        updated_at: z.string().meta({ description: 'Last modification timestamp' }).optional(),
        sample_data: z.array(z.looseObject({})).optional(),
    })
    .meta({ id: 'DataStoreTableDetail' });

export const DataColumnForAIMapSchema = z.object({}).catchall(DataColumnForAISchema).meta({ id: 'DataColumnForAIMap' });

export const ImportJobSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Job ID' }),
        store_id: z.string().meta({ description: 'Parent store ID' }),
        status: ImportStatusSchema.meta({ description: 'Current status' }),
        tables: z.array(z.string()).meta({ description: 'Tables being imported' }),
        mode: z.enum(['append', 'replace']).meta({ description: 'Import mode' }),
        message: z.string().meta({ description: 'Commit message' }).optional(),
        error: z.string().meta({ description: 'Error message (if failed)' }).optional(),
        rows_imported: z.number().meta({ description: 'Total rows imported' }),
        started_at: z.string().meta({ description: 'Job start timestamp' }),
        completed_at: z.string().meta({ description: 'Job completion timestamp' }).optional(),
        version_id: z.string().meta({ description: 'Resulting version ID (if completed)' }).optional(),
        created_by: z.string().meta({ description: 'User/agent who initiated' }).optional(),
    })
    .meta({ id: 'ImportJob', description: 'Import job tracking.' });

export const CreateTablesPayloadSchema = z
    .strictObject({
        tables: z.array(CreateTablePayloadSchema).meta({ description: 'Table definitions to create' }),
        message: z.string().meta({ description: 'Commit message' }),
    })
    .meta({ id: 'CreateTablesPayload', description: 'Payload for creating multiple tables atomically.' });

export const DataTableSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Table name (must be valid SQL identifier)' }),
        description: z.string().meta({ description: 'Human-readable description' }).optional(),
        columns: z.array(DataColumnSchema).meta({ description: 'Column definitions' }),
        foreign_keys: z.array(DataForeignKeySchema).meta({ description: 'Foreign key constraints' }).optional(),
        indexes: z.array(DataIndexSchema).meta({ description: 'Index definitions' }).optional(),
        semantic_type: DataTableSemanticTypeSchema.meta({
            description: 'Semantic categorization for AI understanding',
        }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
        row_count: z.number().meta({ description: 'Current row count (updated after imports)' }).optional(),
        created_at: z.string().meta({ description: 'Table creation timestamp' }).optional(),
        updated_at: z.string().meta({ description: 'Last modification timestamp' }).optional(),
    })
    .meta({ id: 'DataTable', description: 'Table definition within a data schema.' });

export const AlterTablePayloadSchema = z
    .strictObject({
        changes: z.array(AlterTableOperationSchema).meta({ description: 'List of schema changes to apply' }),
    })
    .meta({ id: 'AlterTablePayload', description: 'Payload for altering a table schema.' });

export const UpdateSchemaPayloadSchema = z
    .strictObject({
        description: z.string().meta({ description: 'Updated schema description' }).optional(),
        tables: z.array(CreateTablePayloadSchema).meta({ description: 'Tables to create or update' }).optional(),
        relationships: z.array(DataRelationshipSchema).meta({ description: 'Relationships to set' }).optional(),
        drop_tables: z.array(z.string()).meta({ description: 'Tables to drop' }).optional(),
        message: z.string().meta({ description: 'Commit message (required)' }),
    })
    .meta({ id: 'UpdateSchemaPayload', description: 'Payload for AI-driven bulk schema updates.' });

export const BatchQueryResultSchema = z
    .strictObject({
        results: z.array(BatchQueryResultItemSchema),
    })
    .meta({ id: 'BatchQueryResult' });

export const DataStoreVersionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Version ID' }),
        store_id: z.string().meta({ description: 'Parent store ID' }),
        message: z.string().meta({ description: 'Commit message' }),
        schema_version: z.string().meta({ description: 'Schema version at this point' }),
        tables: DataStoreVersionTableStateMapSchema.meta({ description: 'Table states at this version' }),
        created_at: z.string().meta({ description: 'Creation timestamp' }),
        created_by: z.string().meta({ description: 'User/agent who created' }).optional(),
        gcs_generation: z.number().meta({ description: 'GCS object generation number' }),
        gcs_path_id: z.string().meta({ description: 'Timestamp-based ID used for GCS path (internal)' }).optional(),
        is_snapshot: z.boolean().meta({ description: 'Whether this is a named snapshot' }).optional(),
        snapshot_name: z.string().meta({ description: 'Snapshot name (if is_snapshot)' }).optional(),
    })
    .meta({ id: 'DataStoreVersion', description: 'A point-in-time version of a data store.' });

export const DataStoreItemArraySchema = z.array(DataStoreItemSchema).meta({ id: 'DataStoreItemArray' });

export const ImportTableDataMapSchema = z.object({}).catchall(ImportTableDataSchema).meta({ id: 'ImportTableDataMap' });

export const DataTableForAISchema = z
    .strictObject({
        description: z.string().meta({ description: 'Description' }).optional(),
        semantic_type: DataTableSemanticTypeSchema.meta({ description: 'Semantic type' }).optional(),
        columns: DataColumnForAIMapSchema.meta({ description: 'Columns by name' }),
        foreign_keys: z.array(DataForeignKeyForAISchema).meta({ description: 'Foreign keys' }),
    })
    .meta({ id: 'DataTableForAI', description: 'Simplified table representation for AI agents.' });

export const DataStoreFullSchemaResponseSchema = z
    .strictObject({
        version: z.string().meta({ description: 'Semantic version (e.g., "1.2.0")' }),
        description: z.string().meta({ description: 'Schema description' }).optional(),
        tables: z.array(DataTableSchema).meta({ description: 'Table definitions' }),
        relationships: z.array(DataRelationshipSchema).meta({ description: 'Relationship definitions' }),
        updated_at: z.string().meta({ description: 'Last update timestamp' }),
        updated_by: z.string().meta({ description: 'User/agent who last updated' }).optional(),
        schema_format: z.literal('full'),
    })
    .meta({ id: 'DataStoreFullSchemaResponse' });

export const DataTableArraySchema = z.array(DataTableSchema).meta({ id: 'DataTableArray' });

export const DataSchemaSchema = z
    .strictObject({
        version: z.string().meta({ description: 'Semantic version (e.g., "1.2.0")' }),
        description: z.string().meta({ description: 'Schema description' }).optional(),
        tables: z.array(DataTableSchema).meta({ description: 'Table definitions' }),
        relationships: z.array(DataRelationshipSchema).meta({ description: 'Relationship definitions' }),
        updated_at: z.string().meta({ description: 'Last update timestamp' }),
        updated_by: z.string().meta({ description: 'User/agent who last updated' }).optional(),
    })
    .meta({ id: 'DataSchema', description: 'Complete schema definition for a data store.' });

export const DataStoreVersionArraySchema = z.array(DataStoreVersionSchema).meta({ id: 'DataStoreVersionArray' });

export const ImportDataPayloadSchema = z
    .strictObject({
        tables: ImportTableDataMapSchema.meta({ description: 'Map of table name to data specification' }),
        mode: z.enum(['append', 'replace']).meta({ description: 'Import mode' }),
        message: z.string().meta({ description: 'Commit message' }),
    })
    .meta({ id: 'ImportDataPayload', description: 'Payload for importing data into tables.' });

export const DataTableForAIMapSchema = z.object({}).catchall(DataTableForAISchema).meta({ id: 'DataTableForAIMap' });

export const DataStoreSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags for organization' }),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        status: DataStoreStatusSchema.meta({ description: 'Current status' }),
        schema_version: z.string().meta({ description: 'Current schema version' }),
        table_count: z.number().meta({ description: 'Number of tables' }),
        total_rows: z.number().meta({ description: 'Total rows across all tables' }),
        storage_bytes: z.number().meta({ description: 'Storage size in bytes' }),
        last_import_at: z.string().meta({ description: 'Last import timestamp' }).optional(),
        version_count: z.number().meta({ description: 'Number of versions stored' }),
        schema: DataSchemaSchema.meta({ description: 'Complete schema definition' }),
        gcs_bucket: z.string().meta({ description: 'GCS bucket name' }),
        gcs_path: z.string().meta({ description: 'Path prefix within the bucket' }),
    })
    .meta({ id: 'DataStore', description: 'Full data store with schema details.' });

export const DataSchemaForAISchema = z
    .strictObject({
        schema_format: z.literal('ai'),
        name: z.string().meta({ description: 'Store name' }),
        version: z.string().meta({ description: 'Schema version' }),
        description: z.string().meta({ description: 'Schema description' }).optional(),
        tables: DataTableForAIMapSchema.meta({ description: 'Tables by name' }),
        relationships: z.array(DataRelationshipForAISchema).meta({ description: 'Relationships' }),
    })
    .meta({
        id: 'DataSchemaForAI',
        description:
            'Simplified schema representation optimized for AI agent consumption. Provides semantic context for understanding the data model.',
    });

export const DataStoreSchemaResponseSchema = z
    .discriminatedUnion('schema_format', [DataStoreFullSchemaResponseSchema, DataSchemaForAISchema])
    .meta({ id: 'DataStoreSchemaResponse' });
