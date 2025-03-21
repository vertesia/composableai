import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { AdaptTablesRequest, ContentObject, DocAnalyzerResultResponse, DocAnalyzeRunStatusResponse, DocImage, DocTableCsv, DocTableJson, GetAdaptedTablesRequestQuery, PdfToRichtextOptions, WorkflowRunStatus } from "@vertesia/common";

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

    async getAdaptedTables(runId?: string, query?: GetAdaptedTablesRequestQuery): Promise<any> {
        const path = runId ? `/adapt_tables/${runId}` : "/adapt_tables";
        
        // Build query parameters
        const queryParams: any = {};
        if (query?.format) queryParams.format = query.format;
        if (query?.raw !== undefined) queryParams.raw = query.raw;
        
        // If format is CSV, set response type to text to avoid automatic JSON parsing
        const options: any = { query: queryParams };
        if (query?.format === 'csv') {
            options.responseType = 'text';
        }
        
        return this.get(path, options);
    }

    async getXml(): Promise<string> {
        return this.get("/xml");
    }

    async getTables(): Promise<DocTableCsv[] | DocTableJson[]> {
        return this.get("/tables");
    }

    async getImages(): Promise<DocImage[]> {
        return this.get("/images");
    }

    async getParts(): Promise<ContentObject[]> {
        return this.get("/parts");
    }

    async getAnnotated(): Promise<{ url: string }> {
        return this.get("/annotated");
    }
}