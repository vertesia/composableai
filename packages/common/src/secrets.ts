import type {
    BrowserCredentialMetadata,
    BrowserCredentialRecord,
    BrowserCredentialSecretInput,
} from './browser-credentials.js';

export type SecretKind = 'website_credential';

export interface SecretProjectQuery {
    /**
     * Project scope for top-level secret APIs. Must match the authenticated project context.
     */
    project_id?: string;
}

export interface ListSecretsQuery extends SecretProjectQuery {
    kind?: SecretKind;
    host?: string;
    enabled?: boolean;
}

export interface SecretLookupQuery extends SecretProjectQuery {
    kind?: SecretKind;
}

export interface SecretRecord {
    id: string;
    secret_ref: string;
    kind: SecretKind;
    project: string;
    name: string;
    enabled?: boolean;
    tags?: string[];
    properties?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
    details?: BrowserCredentialRecord;
}

export interface ListSecretsResponse {
    secrets: SecretRecord[];
}

export interface CreateSecretRequest {
    kind: SecretKind;
    metadata: BrowserCredentialMetadata;
    secret?: BrowserCredentialSecretInput;
}

export interface UpdateSecretRequest {
    kind?: SecretKind;
    metadata?: Partial<BrowserCredentialMetadata>;
    secret?: BrowserCredentialSecretInput;
    clear_username_secret?: boolean;
    clear_password?: boolean;
    clear_totp?: boolean;
    clear_oauth?: boolean;
}
