import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    DocAnalyzeRunStatusResponse,
    DocumentPrepOptions,
    GroundedExtractionRequest,
    GroundedExtractionResultResponse,
} from '@vertesia/common';

export class AnalyzeDocApi extends ApiTopic {
    constructor(
        parent: ClientBase,
        public objectId: string,
    ) {
        super(parent, `/${objectId}/analyze`);
    }

    async start(payload: DocumentPrepOptions): Promise<DocAnalyzeRunStatusResponse> {
        return this.post('/', { payload });
    }

    async getStatus(): Promise<DocAnalyzeRunStatusResponse> {
        return this.get('/status');
    }

    async startGroundedExtraction(payload?: GroundedExtractionRequest): Promise<DocAnalyzeRunStatusResponse> {
        return this.post('/grounded', { payload: payload ?? {} });
    }

    async getGroundedExtractionResult(): Promise<GroundedExtractionResultResponse> {
        return this.get('/grounded/result');
    }
}
