import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    BeginSharePointOrganizationLinkPayload,
    ConfigureSharePointOrganizationReaderPayload,
    SharePointLibraryRequest,
    SharePointLibraryRequests,
    SharePointLibraryRequestsQuery,
    SharePointOrganization,
    SharePointOrganizationLinkAttempt,
    SharePointOrganizations,
    SharePointRequestProject,
} from '@vertesia/common';

export default class SharePointOnboardingApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/sharepoint-onboarding');
    }

    beginOrganizationLink(payload: BeginSharePointOrganizationLinkPayload): Promise<SharePointOrganizationLinkAttempt> {
        return this.post('/organization/link-attempts', { payload });
    }

    listOrganizations(): Promise<SharePointOrganizations> {
        return this.get('/organization');
    }

    getOrganization(tenantId: string): Promise<SharePointOrganization> {
        return this.get(`/organization/${encodeURIComponent(tenantId)}`);
    }

    configureOrganizationReader(
        tenantId: string,
        payload: ConfigureSharePointOrganizationReaderPayload,
    ): Promise<SharePointOrganization> {
        return this.put(`/organization/${encodeURIComponent(tenantId)}/reader`, { payload });
    }

    removeOrganizationReader(tenantId: string): Promise<SharePointOrganization> {
        return this.del(`/organization/${encodeURIComponent(tenantId)}/reader`);
    }

    listLibraryRequests(query?: SharePointLibraryRequestsQuery): Promise<SharePointLibraryRequests> {
        return this.get('/library-requests', { query });
    }

    getLibraryRequest(id: string): Promise<SharePointLibraryRequest> {
        return this.get(`/library-requests/${encodeURIComponent(id)}`);
    }

    refreshLibraryRequest(id: string): Promise<SharePointLibraryRequest> {
        return this.post(`/library-requests/${encodeURIComponent(id)}/refresh`);
    }

    resolveRequestProject(id: string): Promise<SharePointRequestProject> {
        return this.get(`/library-requests/${encodeURIComponent(id)}/project`);
    }
}
