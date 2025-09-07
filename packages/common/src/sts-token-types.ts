/**
 * STS Token Request Types
 * These types define the structure for token requests to the Security Token Service
 */

export type TokenType = 'apikey' | 'user' | 'project' | 'environment' | 'agent' | 'service_account';

interface BaseTokenRequest {
    type: TokenType;
    audience?: string;
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

// Agent token for service accounts acting as agents
export interface AgentTokenRequest extends BaseTokenRequest {
    type: 'agent';
    account_id: string;
    project_id: string; // Will verify it belongs to account
    name?: string;
    on_behalf_of: string; // Required: signed Vertesia token to verify user context
}

// Service account token
export interface ServiceAccountTokenRequest extends BaseTokenRequest {
    type: 'service_account';
    account_id: string;
    project_id: string; // Will verify it belongs to account
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
}

export interface ValidateTokenResponse {
    valid: boolean;
    payload?: any;
    error?: string;
}