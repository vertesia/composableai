/**
 * STS Token Request Types
 * These types define the structure for token requests to the Security Token Service
 */

export type TokenType = 'apikey' | 'user' | 'project' | 'environment' | 'agent' | 'service_account' | 'attested_agent';
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
    roles?: string[]; // Optional - roles for the service account token
    name?: string;
}

/**
 * Attested-agent token: minted by a trusted GCP workload (e.g. zeno-worker)
 * for a workflow that runs on behalf of a user. The caller authenticates via
 * GCP workload identity (ADC); business claims (account_id, project_id,
 * user_id) are re-verified server-side against MongoDB. The resulting JWT
 * is shaped identically to an `agent` token — only the issuance path differs.
 */
export interface AttestedAgentTokenRequest extends BaseTokenRequest {
    type: 'attested_agent';
    account_id: string;
    project_id: string;
    user_id: string;
    initiated_by?: string;
    name?: string;
}

export type IssueTokenRequest =
    | ApiKeyTokenRequest
    | UserTokenRequest
    | ProjectTokenRequest
    | EnvironmentTokenRequest
    | AgentTokenRequest
    | ServiceAccountTokenRequest
    | AttestedAgentTokenRequest;

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

export function isAttestedAgentRequest(req: IssueTokenRequest): req is AttestedAgentTokenRequest {
    return req.type === 'attested_agent';
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