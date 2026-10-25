import type * as Wire from '../wire-types.generated.js';
import type { WorkflowExecutionPayload } from './workflow.js';

export type DocumentPrepOptions = Wire.DocumentPrepOptions;

export interface DocumentPrepWorkflowPayload extends Omit<WorkflowExecutionPayload, 'vars'> {
    vars: DocumentPrepOptions;
}

export type DocumentProcessingPhase = Wire.DocumentProcessingPhase;

/**
 * Output format for document processing workflows
 */
export type DocProcessorOutputFormat = Wire.DocProcessorOutputFormat;

/**
 * Represents a document analysis run status
 */
export type DocAnalyzeRunStatusResponse = Wire.DocAnalyzeRunStatusResponse;

export type DocAnalyzerProgress = Wire.DocAnalyzerProgress;

export type DocAnalyzerProgressStatus = Wire.DocAnalyzerProgressStatus;

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
/**
 * The adapted table result format
 */
export interface AdaptedTable {
    comment?: string;
    data: Record<string, unknown>[];
}
