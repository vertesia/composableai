import type { WorkflowExecutionPayload, WorkflowRunStatus } from './workflow.js';

export interface DocumentPrepOptions {
    features?: string[];
    debug?: boolean;
    output_format?: DocProcessorOutputFormat;
    [key: string]: unknown;
}

export interface DocumentPrepWorkflowPayload extends Omit<WorkflowExecutionPayload, 'vars'> {
    vars: DocumentPrepOptions;
}

export type DocumentProcessingPhase = 'markdown' | 'grounded_extraction';

/**
 * Output format for document processing workflows
 */
export type DocProcessorOutputFormat = 'markdown';

/**
 * Represents a document analysis run status
 */
export interface DocAnalyzeRunStatusResponse extends WorkflowRunStatus {
    phase?: DocumentProcessingPhase;
    progress?: DocAnalyzerProgress;
    /** The output format being used for processing. */
    output_format?: DocProcessorOutputFormat;
}

export interface DocAnalyzerProgress {
    phase?: DocumentProcessingPhase;
    pages: DocAnalyzerProgressStatus;
    images: DocAnalyzerProgressStatus;
    tables: DocAnalyzerProgressStatus;
    visuals: DocAnalyzerProgressStatus;
    started_at?: number;
    percent: number;
    /** The output format being used for processing. */
    output_format?: DocProcessorOutputFormat;
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
    format?: 'csv' | 'json';

    /**
     * Process the table as a whole or by page
     */
    process_as?: 'page' | 'table';

    /**
     * Process the table as a CSV file
     */
    process_as_csv?: boolean;
}

interface DocAnalyzerRequestBase {
    synchronous?: boolean;

    notify_endpoints?: string[];

    /**
     * What environment to use to run the request
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
    format: 'csv' | 'json';
}
/**
 * The adapted table result format
 */
export interface AdaptedTable {
    comment?: string;
    data: Record<string, unknown>[];
}

export type AdaptedTableResponse = Record<string, AdaptedTable>;
