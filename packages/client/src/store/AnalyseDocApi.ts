import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { ContentObject, DocAnalyzerResultResponse, DocAnalyzeRunStatusResponse, DocImage, DocTableCsv, DocTableJson, PdfToRichtextOptions } from "@vertesia/common";

export class AnalyzeDocApi extends ApiTopic {
    constructor(parent: ClientBase, public objectId: string) {
        super(parent, "`/${objectId}/analyze");
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

    async getXml(): Promise<string> {
        return this.get("/xml");
    }

    async getTables(): Promise<DocTableCsv[] | DocTableJson[]> {
        return this.get("/tables");
    }

    async getImages(): Promise<DocImage[]> {
        return this.get("/tables");
    }

    async getParts(): Promise<ContentObject[]> {
        return this.get("/parts");
    }

    async getAnnotated(): Promise<{ url: string }> {
        return this.get("/annotated");
    }

}