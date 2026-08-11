import type { z } from 'zod';
import type {
    DocAnalyzeRunStatusResponseSchema,
    DocAnalyzerProgressSchema,
    DocAnalyzerProgressStatusSchema,
    DocProcessorOutputFormatSchema,
    DocumentPrepOptionsSchema,
    DocumentProcessingPhaseSchema,
} from '../api-schemas/document-processing.js';
import type { WorkflowExecutionPayload } from './workflow.js';

export type DocumentPrepOptions = z.infer<typeof DocumentPrepOptionsSchema>;

export interface DocumentPrepWorkflowPayload extends Omit<WorkflowExecutionPayload, 'vars'> {
    vars: DocumentPrepOptions;
}

export type DocumentProcessingPhase = z.infer<typeof DocumentProcessingPhaseSchema>;

/**
 * Output format for document processing workflows
 */
export type DocProcessorOutputFormat = z.infer<typeof DocProcessorOutputFormatSchema>;

/**
 * Represents a document analysis run status
 */
export type DocAnalyzeRunStatusResponse = z.infer<typeof DocAnalyzeRunStatusResponseSchema>;

export type DocAnalyzerProgress = z.infer<typeof DocAnalyzerProgressSchema>;

export type DocAnalyzerProgressStatus = z.infer<typeof DocAnalyzerProgressStatusSchema>;

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
