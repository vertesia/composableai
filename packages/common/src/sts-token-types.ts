/**
 * STS Token Request Types
 * These types define the structure for token requests to the Security Token Service
 */
import type { ProjectRoles } from './project.js';

export type TokenType = 'apikey' | 'user' | 'project' | 'environment' | 'agent' | 'service_account';
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

/**
 * Agent token for a service account to act as agent on behalf of a user.
 *
 * Two trust paths are supported:
 *
 * - `user_access_token`: a live signed Vertesia token. STS verifies the user context from that token.
 * - `workload_id_token`: a workload acts on behalf of a user. It implies that a full verification
 *   will be performed based on the workload identity.
 */
export interface AgentTokenRequest extends BaseTokenRequest {
    type: 'agent';
    account_id: string;
    project_id: string; // Will verify it belongs to account
    name?: string;

    /**
     * User information.
     *
     * The value of this field can be either:
     *   - a signed Vertesia token used to verify the user context
     *   - a user ID prefixed with `user:` to indicate the user on behalf of whom the agent is
     *     acting.
     *
     * @example {JsonWebToken}
     * @example user:68100a7c9f3c2b7d11a1b2c3
     */
    on_behalf_of: string;
}

// Service account token
export interface ServiceAccountTokenRequest extends BaseTokenRequest {
    type: 'service_account';
    account_id: string;
    project_id: string; // Will verify it belongs to account
    roles?: ProjectRoles[]; // Optional - roles for the service account token
    name?: string;
    email?: string;
}

/**
 * @discriminator type
 */
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

export interface IssueTokenResponse {
    token: string;
    token_type: 'Bearer';
    expires_in?: number;
}

export interface ValidateTokenResponse {
    valid: boolean;
    payload?: unknown;
    error?: string;
}
