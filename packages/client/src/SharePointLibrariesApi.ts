import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ApproveSharePointLibraryPayload,
    ConfigureSharePointLibraryReaderPayload,
    ProjectSharePointLibraryResponse,
    SharePointLibraryConnection,
} from '@vertesia/common';

export class SharePointLibrariesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/sharepoint-onboarding/libraries');
    }

    listLibraries(): Promise<SharePointLibraryConnection[]> {
        return this.get('/');
    }

    getLibrary(bindingId: string): Promise<SharePointLibraryConnection> {
        return this.get(`/${encodeURIComponent(bindingId)}`);
    }

    async getProjectLibrary(): Promise<SharePointLibraryConnection | null> {
        const { library } = await this.get<ProjectSharePointLibraryResponse>('/current-project');
        return library;
    }

    async getProjectLibraries(): Promise<SharePointLibraryConnection[]> {
        const { library, libraries = [] } = await this.get<ProjectSharePointLibraryResponse>('/current-project');
        return library ? [library, ...libraries.filter(({ id }) => id !== library.id)] : libraries;
    }

    approveLibrary(bindingId: string, payload: ApproveSharePointLibraryPayload): Promise<SharePointLibraryConnection> {
        return this.post(`/${encodeURIComponent(bindingId)}/approve`, { payload });
    }

    configureLibraryReader(
        bindingId: string,
        payload: ConfigureSharePointLibraryReaderPayload,
    ): Promise<SharePointLibraryConnection> {
        return this.post(`/${encodeURIComponent(bindingId)}/configure-reader`, { payload });
    }

    disconnectLibrary(bindingId: string): Promise<SharePointLibraryConnection> {
        return this.post(`/${encodeURIComponent(bindingId)}/disconnect`);
    }
}
