import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type {
    BrowserCredentialFillRequest,
    BrowserCredentialFillResponse,
    BrowserCredentialRecord,
    CreateBrowserCredentialRequest,
    UpdateBrowserCredentialRequest,
} from "@vertesia/common";

export default class SecretsApi extends ApiTopic {
    readonly browserCredentials: BrowserCredentialsApi;

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/secrets");
        this.browserCredentials = new BrowserCredentialsApi(this);
    }
}

export class BrowserCredentialsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/browser-credentials");
    }

    list(projectId: string, query?: { host?: string; enabled?: boolean }): Promise<BrowserCredentialRecord[]> {
        return this.get('/', { query: { ...query, project_id: projectId } })
            .then((res: { credentials: BrowserCredentialRecord[] }) => res.credentials);
    }

    retrieve(projectId: string, credentialId: string): Promise<BrowserCredentialRecord | undefined> {
        return this.get(`/${credentialId}`, { query: { project_id: projectId } }).catch(err => {
            if (err.status === 404) {
                return undefined;
            }
            throw err;
        });
    }

    create(projectId: string, payload: CreateBrowserCredentialRequest): Promise<BrowserCredentialRecord> {
        return this.post('/', { query: { project_id: projectId }, payload });
    }

    update(
        projectId: string,
        credentialId: string,
        payload: UpdateBrowserCredentialRequest,
    ): Promise<BrowserCredentialRecord> {
        return this.put(`/${credentialId}`, { query: { project_id: projectId }, payload });
    }

    remove(projectId: string, credentialId: string): Promise<void> {
        return this.del(`/${credentialId}`, { query: { project_id: projectId } });
    }

    fillBrowser(
        projectId: string,
        credentialId: string,
        payload: BrowserCredentialFillRequest,
    ): Promise<BrowserCredentialFillResponse> {
        return this.post(`/${credentialId}/fill-browser`, { query: { project_id: projectId }, payload });
    }
}
