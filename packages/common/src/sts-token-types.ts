/**
 * STS Token Request Types
 * These types define the structure for token requests to the Security Token Service
 */

export type TokenType = 'apikey' | 'user' | 'project' | 'environment' | 'agent' | 'service_account';

/**
 * Trust path used by the STS to authorize an agent-token issuance.
 *
 * - `user_access_token`: issuance is authorized by a live user (or
 *   user-equivalent) access token passed in `on_behalf_of`. This is the
 *   pre-existing path and remains the default when `assertion_type` is omitted.
 * - `workload_id_token`: issuance is authorized by the caller's workload
 *   identity (e.g. a GCP service account on GKE). The STS re-verifies all
 *   business claims (`account_id`, `project_id`, `user_id`) against MongoDB.
 *   This path is intended for trusted workloads (e.g. zeno-worker) that need
 *   to refresh an agent token without holding a live user token.
 */
// export type AgentAssertionType = 'user_access_token' | 'workload_id_token';
export type SigningAlgorithm = 'ES256' | 'RS256';

interface BaseTokenRequest {
    type: TokenType;
    audience?: string;
    /** Signing algorithm - defaults to ES256. Use RS256 for Azure AD compatibility. */
    algorithm?: SigningAlgorithm;
}

// API key doesn't need account/project as it's determined from the key
export interface ApiKeyTokenRequest extends BaseTokenRequest {
    type: 'apikey';
    key: string;
}

// User token needs optional account/project for scoping
export interface UserTokenRequest extends BaseTokenRequest {
    type: 'user';
    user_id?: string; // Optional - can be determined from auth token
    account_id?: string; // Optional - for scoping to specific account
    project_id?: string; // Optional - for scoping to specific project
    expires_at?: number;

    on_behalf_of?: string; // Optional - user ID when acting on behalf of another user
}

// Project token requires project_id and account_id
export interface ProjectTokenRequest extends BaseTokenRequest {
    type: 'project';
    project_id: string;
    account_id: string;
}

// Environment token requires IDs - names fetched from DB
export interface EnvironmentTokenRequest extends BaseTokenRequest {
    type: 'environment';
    environment_id: string;
    environment_name: string; // Still required as environments may not be in DB
    project_id: string; // Will fetch name and verify account
    account_id: string; // Will fetch name and verify project belongs to it
}

// Agent token for service accounts acting as agents.
//
// Two trust paths are supported:
//
// - `user_access_token`: caller must supply `on_behalf_of`, a live signed Vertesia token. STS
//   verifies the user context from that token.
// - `workload_id_token`: caller must supply `on_behalf_of_user`, the user ID the agent acts on. It
//   implies that a full verification will be performed based on the workload identity.
export interface AgentTokenRequest extends BaseTokenRequest {
    type: 'agent';
    account_id: string;
    project_id: string; // Will verify it belongs to account
    name?: string;

    /**
     * A signed Vertesia token used to verify the user context.
     *
     * @optional Either this field or `on_behalf_of_user` must be provided.
     */
    on_behalf_of?: string;

    /**
     * The user ID the agent is acting on behalf of. It implies a full verification.
     *
     * @optional Either this field or `on_behalf_of` must be provided.
     * @example 68100a7c9f3c2b7d11a1b2c3
     */
    on_behalf_of_user?: string;
}

// Service account token
export interface ServiceAccountTokenRequest extends BaseTokenRequest {
    type: 'service_account';
    account_id: string;
    project_id: string; // Will verify it belongs to account
    roles?: string[]; // Optional - roles for the service account token
    name?: string;
}

export type IssueTokenRequest =
    | ApiKeyTokenRequest
    | UserTokenRequest
    | ProjectTokenRequest
    | EnvironmentTokenRequest
    | AgentTokenRequest
    | ServiceAccountTokenRequest;

export interface RefreshTokenRequest {
    token: string;
}

export interface RevokeTokenRequest {
    token: string;
}

// Helper type guards for type narrowing
export function isApiKeyRequest(req: IssueTokenRequest): req is ApiKeyTokenRequest {
    return req.type === 'apikey';
}

export function isUserRequest(req: IssueTokenRequest): req is UserTokenRequest {
    return req.type === 'user';
}

export function isProjectRequest(req: IssueTokenRequest): req is ProjectTokenRequest {
    return req.type === 'project';
}

export function isEnvironmentRequest(req: IssueTokenRequest): req is EnvironmentTokenRequest {
    return req.type === 'environment';
}

export function isAgentRequest(req: IssueTokenRequest): req is AgentTokenRequest {
    return req.type === 'agent';
}

export function isServiceAccountRequest(req: IssueTokenRequest): req is ServiceAccountTokenRequest {
    return req.type === 'service_account';
}

// Response types
export interface TokenResponse {
    token: string;
    token_type?: string;
    expires_in?: number;
}

export interface ValidateTokenResponse {
    valid: boolean;
    payload?: any;
    error?: string;
}