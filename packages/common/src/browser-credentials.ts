export type WebsiteCredentialCapability = 'password' | 'totp' | 'oauth';

export type WebsiteCredentialTotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface WebsiteCredentialWebsite {
    /**
     * Hostname this credential is allowed on. Subdomains match.
     */
    host: string;
    /**
     * Optional login URL used by agents as a hint.
     */
    login_url?: string;
    /**
     * Optional narrower origin allowlist for this credential.
     */
    allowed_origins?: string[];
}

export interface WebsiteCredentialTotpMetadata {
    algorithm?: WebsiteCredentialTotpAlgorithm;
    digits?: 6 | 8;
    period?: number;
    issuer?: string;
    account?: string;
}

export interface WebsiteCredentialMetadata {
    name: string;
    websites: WebsiteCredentialWebsite[];
    username?: string;
    username_hint?: string;
    username_secret?: boolean;
    properties?: Record<string, unknown>;
    tags?: string[];
    enabled?: boolean;
    capabilities?: WebsiteCredentialCapability[];
    notes?: string;
    totp?: WebsiteCredentialTotpMetadata;
    /**
     * Optional ISO timestamp after which the credential is no longer usable.
     * Expired credentials are hidden from lookup and cannot be filled.
     */
    expires_at?: string;
}

export interface WebsiteCredentialRecord {
    id: string;
    credential_ref: string;
    project: string;
    name: string;
    websites: WebsiteCredentialWebsite[];
    username?: string;
    username_hint?: string;
    username_secret_enabled: boolean;
    properties?: Record<string, unknown>;
    tags?: string[];
    enabled?: boolean;
    capabilities?: WebsiteCredentialCapability[];
    notes?: string;
    totp_metadata?: WebsiteCredentialTotpMetadata;
    /**
     * Optional ISO timestamp after which the credential is no longer usable.
     * Expired credentials are hidden from lookup and cannot be filled.
     */
    expires_at?: string;
    created_at?: string;
    updated_at?: string;
    has_username_secret: boolean;
    has_password: boolean;
    has_totp: boolean;
    has_oauth: boolean;
    password_hint?: string;
}

export interface WebsiteCredentialSecretInput {
    /**
     * Optional encrypted username. Prefer metadata.username unless the username itself is sensitive.
     */
    username?: string;
    password?: string;
    totp?: WebsiteCredentialTotpMetadata & {
        seed: string;
    };
    /**
     * Future OAuth materialization hook. The token itself remains in the OAuth secret store.
     */
    oauth?: {
        provider_id?: string;
        token_owner?: 'user' | 'project';
        token_ref?: string;
    };
}

export interface CreateWebsiteCredentialRequest extends WebsiteCredentialMetadata {
    secret?: WebsiteCredentialSecretInput;
}

export interface UpdateWebsiteCredentialRequest extends Partial<WebsiteCredentialMetadata> {
    secret?: WebsiteCredentialSecretInput;
    clear_username_secret?: boolean;
    clear_password?: boolean;
    clear_totp?: boolean;
    clear_oauth?: boolean;
}

export interface WebsiteCredentialFillTarget {
    username_target_id?: string;
    password_target_id?: string;
    totp_target_id?: string;
    submit_target_id?: string;
}

export interface WebsiteCredentialFillRequest extends WebsiteCredentialFillTarget {
    /**
     * Browser-use parent workflow id. The API resolves the Daytona sandbox and
     * observes the current page server-side before decrypting the credential.
     */
    browser_workflow_id: string;
}

export interface WebsiteCredentialFillResponse {
    ok: boolean;
    credential_ref: string;
    url: string;
    title: string;
    filled: {
        username: boolean;
        password: boolean;
        totp: boolean;
        submitted: boolean;
    };
}
