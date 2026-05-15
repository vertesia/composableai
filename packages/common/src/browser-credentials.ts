export type BrowserCredentialCapability = 'password' | 'totp' | 'oauth';

export type BrowserCredentialTotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface BrowserCredentialWebsite {
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

export interface BrowserCredentialTotpMetadata {
    algorithm?: BrowserCredentialTotpAlgorithm;
    digits?: 6 | 8;
    period?: number;
    issuer?: string;
    account?: string;
}

export interface BrowserCredentialMetadata {
    name: string;
    websites: BrowserCredentialWebsite[];
    username?: string;
    username_hint?: string;
    username_secret?: boolean;
    properties?: Record<string, unknown>;
    tags?: string[];
    enabled?: boolean;
    capabilities?: BrowserCredentialCapability[];
    notes?: string;
    totp?: BrowserCredentialTotpMetadata;
    /**
     * Optional ISO timestamp after which the credential is no longer usable.
     * Expired credentials are hidden from lookup and cannot be filled.
     */
    expires_at?: string;
}

export interface BrowserCredentialSecretInput {
    /**
     * Optional encrypted username. Prefer metadata.username unless the username itself is sensitive.
     */
    username?: string;
    password?: string;
    totp?: BrowserCredentialTotpMetadata & {
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

export interface BrowserCredentialRecord extends BrowserCredentialMetadata {
    id: string;
    credential_ref: string;
    project: string;
    created_at?: string;
    updated_at?: string;
    has_username_secret: boolean;
    has_password: boolean;
    has_totp: boolean;
    has_oauth: boolean;
    password_hint?: string;
}

export interface CreateBrowserCredentialRequest extends BrowserCredentialMetadata {
    secret?: BrowserCredentialSecretInput;
}

export interface UpdateBrowserCredentialRequest extends Partial<BrowserCredentialMetadata> {
    secret?: BrowserCredentialSecretInput;
    clear_username_secret?: boolean;
    clear_password?: boolean;
    clear_totp?: boolean;
    clear_oauth?: boolean;
}

export interface BrowserCredentialFillTarget {
    username_target_id?: string;
    password_target_id?: string;
    totp_target_id?: string;
    submit_target_id?: string;
}

export interface BrowserCredentialFillRequest extends BrowserCredentialFillTarget {
    /**
     * Browser-use parent workflow id. The API resolves the Daytona sandbox and
     * observes the current page server-side before decrypting the credential.
     */
    browser_workflow_id: string;
}

export interface BrowserCredentialFillResponse {
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
