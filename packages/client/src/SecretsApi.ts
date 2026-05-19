import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

/**
 * Project-scoped secret access. Mirrors the studio-server SecretsResource
 * at /api/v1/secrets.
 *
 * The only path on the platform that returns plaintext credential
 * material is `/access` — all other reads are metadata-only. Access
 * is gated by `Permission.secret_accessor` (Developer role has it
 * via inheritance today; future hardening will narrow this).
 */
export default class SecretsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/secrets");
    }

    /**
     * Returns metadata only — `has_value`, never plaintext. Suitable
     * for UI status checks ("is this connection's password set?").
     */
    metadata(purpose: string): Promise<SecretMetadataResponse> {
        return this.get(`/${encodeURIComponent(purpose)}`);
    }

    /**
     * Returns the decrypted plaintext value for the given purpose.
     * Requires `Permission.secret_accessor` on the caller's principal.
     *
     * Toxic value — never log, never return from another endpoint,
     * never persist outside the calling activity's process memory.
     */
    access(purpose: string): Promise<SecretAccessResponse> {
        return this.post(`/${encodeURIComponent(purpose)}/access`, { payload: {} });
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
