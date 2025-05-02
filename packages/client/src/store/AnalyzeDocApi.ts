import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { AdaptedTable, AdaptTablesRequest, DocAnalyzerResultResponse, DocAnalyzeRunStatusResponse, DocImage, DocTableCsv, DocTableJson, ExportTableFormats, GetAdaptedTablesRequestQuery, PdfToRichtextOptions, WorkflowRunStatus } from "@vertesia/common";

export class AnalyzeDocApi extends ApiTopic {
    constructor(parent: ClientBase, public objectId: string) {
        super(parent, `/${objectId}/analyze`);
    }

    async start(payload: PdfToRichtextOptions): Promise<DocAnalyzeRunStatusResponse> {
        return this.post("/", { payload });
    }

    async getStatus(): Promise<DocAnalyzeRunStatusResponse> {
        return this.get("/status");
    }

    async getResults(): Promise<DocAnalyzerResultResponse> {
        return this.get("/results");
    }

    async adaptTables(payload: AdaptTablesRequest): Promise<WorkflowRunStatus> {
        return this.post("/adapt_tables", { payload });
    }

    async getAdaptedTables(runId?: string, query?: GetAdaptedTablesRequestQuery): Promise<Record<number, AdaptedTable>> {
        const path = runId ? `/adapt_tables/${runId}` : "/adapt_tables";
        
        // Build query parameters
        const queryParams: any = {};
        if (query?.format) queryParams.format = query.format;
        if (query?.raw !== undefined) queryParams.raw = query.raw;
        
        // If format is CSV, use text reader to avoid automatic JSON parsing
        const options: any = { query: queryParams };
        if (query?.format === 'csv') {
            options.reader = (response: Response) => response.text();
        }
        
        return this.get(path, options);
    }

    async getXml(): Promise<string> {
        return this.get("/xml");
    }

    async getTables(format?: ExportTableFormats): Promise<DocTableCsv[] | DocTableJson[]> {
        const options: any = {};
        if (format) {
            options.query = {format: format}
        }
        return this.get("/tables", options);
    }

    async getImages(): Promise<DocImage[]> {
        return this.get("/images");
    }

    async getMarkdown(): Promise<string> {
        return this.get("/markdown", { 
            reader: response => response.text() 
        });
    }

    async getAnnotated(): Promise<{ url: string }> {
        return this.get("/annotated");
    }
}