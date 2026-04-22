export type OAuthClientType = 'public' | 'confidential';
export type OAuthClientStatus = 'active' | 'disabled';
export type OAuthRegistrationSource = 'admin' | 'dynamic';
export type OAuthProjectBindingMode = 'user_select' | 'fixed';
export type OAuthTokenEndpointAuthMethod = 'none' | 'client_secret_post' | 'client_secret_basic';
export type OAuthGrantType = 'authorization_code' | 'refresh_token';
export type OAuthResponseType = 'code';
export type OAuthAuthorizationRequestStatus = 'pending' | 'denied' | 'consumed';
export type OAuthClientRegistrationMode = 'registered' | 'client_id_metadata_document';

export interface OAuthClientData {
    client_name: string;
    client_type: OAuthClientType;
    redirect_uris: string[];
    grant_types: OAuthGrantType[];
    response_types: OAuthResponseType[];
    token_endpoint_auth_method: OAuthTokenEndpointAuthMethod;
    allowed_scopes: string[];
    registration_source: OAuthRegistrationSource;
    status: OAuthClientStatus;
    project_binding_mode: OAuthProjectBindingMode;
    fixed_project_id?: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
    client_secret_configured?: boolean;
    created_at: string;
    updated_at: string;
}

export interface OAuthClient extends OAuthClientData {
    client_id: string;
}

export interface OAuthClientCreateResponse extends OAuthClient {
    client_secret?: string;
}

export interface CreateOAuthClientPayload {
    client_name: string;
    client_type?: OAuthClientType;
    redirect_uris: string[];
    grant_types?: OAuthGrantType[];
    response_types?: OAuthResponseType[];
    token_endpoint_auth_method?: OAuthTokenEndpointAuthMethod;
    allowed_scopes?: string[];
    project_binding_mode?: OAuthProjectBindingMode;
    fixed_project_id?: string;
    client_secret?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateOAuthClientPayload {
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: OAuthGrantType[];
    response_types?: OAuthResponseType[];
    token_endpoint_auth_method?: OAuthTokenEndpointAuthMethod;
    allowed_scopes?: string[];
    status?: OAuthClientStatus;
    project_binding_mode?: OAuthProjectBindingMode;
    fixed_project_id?: string;
    client_secret?: string;
    metadata?: Record<string, unknown>;
}

export interface OAuthAuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    registration_endpoint?: string;
    revocation_endpoint?: string;
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    scopes_supported: string[];
    client_id_metadata_document_supported?: boolean;
}

export interface OAuthClientMetadataDocument {
    client_id: string;
    client_name?: string;
    redirect_uris: string[];
    grant_types?: OAuthGrantType[];
    response_types?: OAuthResponseType[];
    token_endpoint_auth_method?: OAuthTokenEndpointAuthMethod;
    scope?: string;
    client_uri?: string;
    logo_uri?: string;
}

export interface OAuthAuthorizeQuery {
    response_type: 'code';
    client_id: string;
    redirect_uri: string;
    resource?: string;
    scope?: string;
    state?: string;
    code_challenge: string;
    code_challenge_method: 'S256';
    project_id?: string;
}

export interface CreateOAuthAuthorizationRequestPayload extends OAuthAuthorizeQuery {}

export interface OAuthAuthorizationRequest {
    request_id: string;
    client_id: string;
    client_name: string;
    client_registration_mode?: OAuthClientRegistrationMode;
    redirect_uri: string;
    redirect_origin: string;
    resource?: string;
    requested_scopes: string[];
    requested_project_id?: string;
    project_binding_mode: OAuthProjectBindingMode;
    fixed_project_id?: string;
    status: OAuthAuthorizationRequestStatus;
    created_at: string;
    expires_at: string;
}

export interface ApproveOAuthAuthorizationRequestPayload {
    project_id?: string;
}

export interface OAuthAuthorizationDecisionResponse {
    redirect_url: string;
}

export interface OAuthTokenRequestAuthorizationCode {
    grant_type: 'authorization_code';
    code: string;
    redirect_uri: string;
    client_id: string;
    resource?: string;
    code_verifier: string;
    client_secret?: string;
}

export interface OAuthTokenRequestRefreshToken {
    grant_type: 'refresh_token';
    refresh_token: string;
    client_id: string;
    resource?: string;
    client_secret?: string;
}

export type OAuthTokenRequest = OAuthTokenRequestAuthorizationCode | OAuthTokenRequestRefreshToken;

export interface OAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    refresh_token?: string;
    id_token?: string;
}

export interface OAuthAuthorizationCodeRecord {
    code: string;
    client_id: string;
    user_id: string;
    account_id: string;
    project_id: string;
    resource: string;
    scope: string[];
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: 'S256';
    expires_at: string;
}

export interface OAuthConsentRecord {
    user_id: string;
    client_id: string;
    account_id: string;
    project_id: string;
    scope: string[];
    granted_at: string;
    revoked_at?: string;
}

export interface OAuthAccessTokenPayload {
    sub: string;
    name: string;
    email?: string;
    type: 'oauth_access';
    iss: string;
    aud: string;
    exp: number;
    client_id: string;
    scope: string;
    scopes: string[];
    user_id: string;
    account: {
        id: string;
        name: string;
    };
    account_roles: string[];
    accounts: Array<{
        id: string;
        name: string;
    }>;
    project: {
        id: string;
        name: string;
    };
    project_roles: string[];
    apps: string[];
    permissions?: string[];
    allowed_collections?: string[];
    tags?: string[];
    resource?: string;
}
