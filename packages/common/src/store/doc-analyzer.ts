import { WorkflowExecutionPayload } from "./workflow.js";

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
    data: string;
}

/**
 * Represents a table in a document that has been analyzed in JSON format
 */
export interface DocTableJson extends DocTable {
    format: "application/json";
    data: Object;
}

/**
 * Represents a document analysis run status
 */
export interface DocAnalyzeRunStatusResponse {
    workflow_id: string|null;
    run_id: string|null;
    status: 'processing' | 'completed' | 'failed' | 'not-found';
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
    layouts: DocAnalyzerProgressStatus,
    started_at?: number;
    time_elapsed?: number;
  }
  
  interface DocAnalyzerProgressStatus {
    total: number;
    processed: number;
    success: number;
    failed: number;
  }