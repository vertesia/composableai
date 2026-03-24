/**
 * OAuth Application types for generic, project-level OAuth 2.0 integration.
 * Decoupled from MCP — can be used by MCP collections, tool activities, or any OAuth-protected API.
 */

/**
 * OAuth Application data stored in MongoDB.
 * Represents the configuration for an OAuth 2.0 provider at the project level.
 */
export interface OAuthApplicationData {
    /**
     * Unique name within the project (kebab-case identifier).
     */
    name: string;

    /**
     * Human-readable display name.
     */
    display_name: string;

    /**
     * The project this OAuth application belongs to.
     */
    project: string;

    /**
     * The OAuth 2.0 authorization endpoint URL.
     * Optional when endpoints are discovered via .well-known (e.g. MCP servers).
     */
    authorization_endpoint?: string;

    /**
     * The OAuth 2.0 token endpoint URL.
     * Optional when endpoints are discovered via .well-known (e.g. MCP servers).
     */
    token_endpoint?: string;

    /**
     * The OAuth client ID (always required).
     */
    client_id: string;

    /**
     * Whether a client_secret is configured (never exposes the actual secret).
     */
    has_client_secret?: boolean;

    /**
     * Default scopes to request during authorization.
     */
    default_scopes?: string[];

    /**
     * Whether to use PKCE (Proof Key for Code Exchange) in the authorization flow.
     * Defaults to true.
     */
    use_pkce: boolean;

    /**
     * Optional OAuth 2.0 revocation endpoint URL.
     */
    revocation_endpoint?: string;

    created_at: string;
    updated_at: string;
}

/**
 * OAuth Application as returned by the API (with id).
 */
export interface OAuthApplication extends OAuthApplicationData {
    id: string;
}

/**
 * Payload for creating an OAuth Application.
 * The client_secret is accepted as plaintext on create and stored encrypted.
 */
export interface CreateOAuthApplicationPayload {
    name: string;
    display_name: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    client_id: string;
    /**
     * Optional client secret for confidential clients.
     * Will be encrypted at rest and never returned in API responses.
     */
    client_secret?: string;
    default_scopes?: string[];
    use_pkce?: boolean;
    revocation_endpoint?: string;
}

/**
 * Payload for updating an OAuth Application.
 * All fields are optional — only provided fields are updated.
 * To clear the client_secret, set it to an empty string.
 */
export type UpdateOAuthApplicationPayload = Partial<CreateOAuthApplicationPayload>;

/**
 * OAuth authentication status for a user against an OAuth Application.
 */
export interface OAuthAppAuthStatus {
    oauth_app_id: string;
    oauth_app_name: string;
    authenticated: boolean;
    expires_at?: string;
    scope?: string;
}

/**
 * Response from the OAuth authorize endpoint.
 */
export interface OAuthAppAuthorizeResponse {
    authorization_url: string;
    state: string;
}
