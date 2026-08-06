/**
 * STS Token Request Types
 * These types define the structure for token requests to the Security Token Service
 */
import type { z } from 'zod';
import type {
    AgentTokenRequestSchema,
    ApiKeyTokenRequestSchema,
    EnvironmentTokenRequestSchema,
    IssueTokenForbiddenResponseSchema,
    IssueTokenRequestSchema,
    IssueTokenResponseSchema,
    ProjectTokenRequestSchema,
    ServiceAccountTokenRequestSchema,
    SigningAlgorithmSchema,
    TokenTypeSchema,
    UserTokenRequestSchema,
} from './api-schemas/sts.js';

export type TokenType = z.infer<typeof TokenTypeSchema>;
export type SigningAlgorithm = z.infer<typeof SigningAlgorithmSchema>;

// API key doesn't need account/project as it's determined from the key
export type ApiKeyTokenRequest = z.infer<typeof ApiKeyTokenRequestSchema>;

// User token needs optional account/project for scoping
export type UserTokenRequest = z.infer<typeof UserTokenRequestSchema>;

// Project token requires project_id and account_id
export type ProjectTokenRequest = z.infer<typeof ProjectTokenRequestSchema>;

// Environment token requires IDs - names fetched from DB
export type EnvironmentTokenRequest = z.infer<typeof EnvironmentTokenRequestSchema>;

/**
 * Agent token for a service account to act as agent on behalf of a user.
 *
 * Two trust paths are supported:
 *
 * - `user_access_token`: a live signed Vertesia token. STS verifies the user context from that token.
 * - `workload_id_token`: a workload acts on behalf of a user. It implies that a full verification
 *   will be performed based on the workload identity.
 */
export type AgentTokenRequest = z.infer<typeof AgentTokenRequestSchema>;

// Service account token
export type ServiceAccountTokenRequest = z.infer<typeof ServiceAccountTokenRequestSchema>;

/**
 * @discriminator type
 */
export type IssueTokenRequest = z.infer<typeof IssueTokenRequestSchema>;

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

export type IssueTokenResponse = z.infer<typeof IssueTokenResponseSchema>;
export type IssueTokenForbiddenResponse = z.infer<typeof IssueTokenForbiddenResponseSchema>;

export interface ValidateTokenResponse {
    valid: boolean;
    payload?: unknown;
    error?: string;
}
