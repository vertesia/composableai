import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type {
    WebsiteCredentialFillRequest,
    WebsiteCredentialFillResponse,
    CreateSecretRequest,
    ListSecretsQuery,
    SecretKind,
    SecretRecord,
    UpdateSecretRequest,
} from "@vertesia/common";

/**
 * Project-scoped secret access. Mirrors the studio-server SecretsResource
 * at /api/v1/secrets.
 *
 * Two distinct surfaces share this client:
 *   - Project-scoped CRUD on `SecretRecord` (list/retrieve/create/update/remove/
 *     fillWebsiteCredential) — manages user-managed secrets identified by
 *     Mongo ObjectId, scoped per project. Came in from main.
 *   - Purpose-scoped metadata/access — the dedicated path the platform
 *     uses to fetch decrypted credential material at runtime, gated by
 *     `Permission.secret_accessor`. Came in from this branch's
 *     migration work.
 *
 * Server-side, the GET /:id route disambiguates by parameter format
 * (ObjectId vs free-form purpose string). Keep the two surfaces in mind
 * when extending — `retrieve(secretId)` returns metadata about a stored
 * record; `metadata(purpose)` reports whether a credential is *set* for
 * a given purpose without revealing it.
 */
export default class SecretsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/secrets");
    }

    list(projectId: string, query?: Omit<ListSecretsQuery, "project_id">): Promise<SecretRecord[]> {
        return this.get('/', { query: { ...query, project_id: projectId } })
            .then((res: { secrets: SecretRecord[] }) => res.secrets);
    }

    retrieve(projectId: string, secretId: string, query?: { kind?: SecretKind }): Promise<SecretRecord | undefined> {
        return this.get(`/${secretId}`, { query: { ...query, project_id: projectId } }).catch(err => {
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

    /**
     * Purpose-keyed metadata read. Returns whether a credential is set
     * for the given purpose, never the plaintext. UI status checks use
     * this to render "configured / not configured" badges.
     *
     * Route is `/by-purpose/:purpose` (not `/:purpose`) — top-level
     * `/:secretId` is reserved for `SecretRecord` ObjectId lookups.
     */
    metadata(purpose: string): Promise<SecretMetadataResponse> {
        return this.get(`/by-purpose/${encodeURIComponent(purpose)}`);
    }

    /**
     * Purpose-keyed plaintext fetch. Requires `Permission.secret_accessor`
     * on the caller's principal. Toxic value — never log, never return
     * from another endpoint, never persist outside the calling
     * activity's process memory.
     */
    access(purpose: string): Promise<SecretAccessResponse> {
        return this.post(`/by-purpose/${encodeURIComponent(purpose)}/access`, { payload: {} });
    }
}

export interface SecretMetadataResponse {
    purpose: string;
    has_value: boolean;
}

export interface SecretAccessResponse {
    purpose: string;
    /** Decrypted plaintext. See SecretsApi.access doc. */
    value: string;
}
