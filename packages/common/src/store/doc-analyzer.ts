import { WorkflowExecutionPayload, WorkflowRunStatus } from "./workflow.js";

export interface PdfToRichtextOptions {
    features: string[];
    debug?: boolean;
    [key: string]: any;
}

export interface PdfToRichTextWorkflowPayload extends Omit<WorkflowExecutionPayload, "vars"> {
    vars: PdfToRichtextOptions;
}

/**
 * Represents a image in a document that has been analyzed
 */
export interface DocImage {
    id?: string;
    page_number?: number;
    description?: string;
    is_meaningful?: boolean;
    width?: number;
    height?: number;
}

/**
 * The export type formats for tables.
 */
export type ExportTableFormats = 'json' | 'csv' | 'xml';

/**
 * Represents a table in a document that has been analyzed
 */
export interface DocTable {
    page_number?: number;
    table_number?: number;
    title?: string;
    format: "application/csv" | "application/json";
}

/**
 * Represents a table in a document that has been analyzed in CSV format
 */
export interface DocTableCsv extends DocTable {
    format: "application/csv";
    title?: string;
    data: string;
}

/**
 * Represents a table in a document that has been analyzed in JSON format
 */
export interface DocTableJson extends DocTable {
    format: "application/json";
    title?: string;
    data: Object[];
}

/**
 * Represents a document analysis run status
 */
export interface DocAnalyzeRunStatusResponse extends WorkflowRunStatus {
    progress?: DocAnalyzerProgress;
}

export interface DocAnalyzerResultResponse {
    document?: string;
    tables?: DocTableCsv[] | DocTableJson[];
    images?: DocImage[];
    annotated?: string | null;
}

export interface DocAnalyzerProgress {
    pages: DocAnalyzerProgressStatus;
    images: DocAnalyzerProgressStatus;
    tables: DocAnalyzerProgressStatus;
    visuals: DocAnalyzerProgressStatus;
    started_at?: number;
    percent: number;
}

interface DocAnalyzerProgressStatus {
    total: number;
    processed: number;
    success: number;
    failed: number;
}

/**
 * Adapt Tables Parameters, part of the request
 */
export interface AdaptTablesParams {
    /**
     * JSON Schema to to convert the table into
     */
    target_schema: string;

    /**
     * Natural language description of the type item the table are composed of
     */
    item_name: string;

    /**
     * Natural language description of the type of table or item to convert
     */
    instructions?: string;

    /**
     * Format to return the data in (csv, json)
     */
    format?: "csv" | "json";

    /**
     * Process the table as a whole or by page
     */
    process_as?: "page" | "table";

    /**
     * Process the table as a CSV file
     */
    process_as_csv?: boolean;
}

interface DocAnalyzerRequestBase {
    synchroneous?: boolean;

    notify_endpoints?: string[];

    /**
     * What environmenet to use to run the request
     * If none specified the project embedded environment will be used
     */
    environment?: string;
}

export interface AdaptTablesRequest extends DocAnalyzerRequestBase, AdaptTablesParams {}

/**
 * Get Adapted Tables Request
 * @param raw If true, the raw data will be returned
 * @param format The format to return the data in (csv, json)
 */
export interface GetAdaptedTablesRequestQuery {
    raw?: boolean;
    format: "csv" | "json";
}
/**
 * The adapted table result format
 */
export interface AdaptedTable {
    comment?: string;
    data: Record<string, any>[];
}
