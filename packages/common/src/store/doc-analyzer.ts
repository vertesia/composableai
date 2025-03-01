import { WorkflowExecutionPayload, WorkflowExecutionStatus } from "./workflow.js";

export interface PdfToRichtextOptions {
    features: string[];
    debug?: boolean;
    [key: string]: any;
}


export interface PdfToRichTextWorkflowParams extends Omit<WorkflowExecutionPayload, "vars"> {
    vars: PdfToRichtextOptions
}

/**
 * Represents a image in a document that has been analyzed
 */
export interface DocImage {
    id?: string;
    page_number?: number;
    image_number?: number;
    title?: string;
    url?: string;
    description?: string;
    is_meaningful?: boolean;
    width?: number;
    height?: number;
    path?: string;
}

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
export interface DocAnalyzeRunStatusResponse {
    workflow_id: string | null;
    run_id: string | null;
    status: WorkflowExecutionStatus;
    progress?: DocAnalyzerProgress;
}


export interface DocAnalyzerResultResponse {
    document?: string;
    tables?: DocTableCsv[] | DocTableJson[];
    images?: DocImage[];
    parts?: { id: string, title: string }[];
    annotated?: string | null;
}


export interface DocAnalyzerProgress {
    pages: DocAnalyzerProgressStatus,
    images: DocAnalyzerProgressStatus,
    tables: DocAnalyzerProgressStatus,
    visuals: DocAnalyzerProgressStatus,
    started_at?: number;
    percent: number;
}

interface DocAnalyzerProgressStatus {
    total: number;
    processed: number;
    success: number;
    failed: number;
}