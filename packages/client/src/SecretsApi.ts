import { ApiTopic, type ClientBase } from "@vertesia/api-fetch-client";
import type {
    WebsiteCredentialFillRequest,
    WebsiteCredentialFillResponse,
    CreateSecretRequest,
    ListSecretsQuery,
    SecretKind,
    SecretRecord,
    UpdateSecretRequest,
} from "@vertesia/common";

export default class SecretsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/secrets");
    }

    list(projectId: string, query?: Omit<ListSecretsQuery, "project_id">): Promise<SecretRecord[]> {
        return this.get<{ secrets: SecretRecord[] }>('/', { query: { ...query, project_id: projectId } })
            .then((res) => res.secrets);
    }

    retrieve(projectId: string, secretId: string, query?: { kind?: SecretKind }): Promise<SecretRecord | undefined> {
        return this.get<SecretRecord>(`/${secretId}`, { query: { ...query, project_id: projectId } }).catch(err => {
            if (err.status === 404) {
                return undefined;
            }
            throw err;
        });
    }

    create(projectId: string, payload: CreateSecretRequest): Promise<SecretRecord> {
        return this.post('/', { query: { project_id: projectId }, payload });
    }

    update(
        projectId: string,
        secretId: string,
        payload: UpdateSecretRequest,
        query?: { kind?: SecretKind },
    ): Promise<SecretRecord> {
        return this.put(`/${secretId}`, { query: { ...query, project_id: projectId }, payload });
    }

    remove(projectId: string, secretId: string, query?: { kind?: SecretKind }): Promise<void> {
        return this.del(`/${secretId}`, { query: { ...query, project_id: projectId } });
    }

    fillWebsiteCredential(
        projectId: string,
        secretId: string,
        payload: WebsiteCredentialFillRequest,
    ): Promise<WebsiteCredentialFillResponse> {
        return this.post(`/${secretId}/actions/fill-browser`, { query: { project_id: projectId }, payload });
    }
}
