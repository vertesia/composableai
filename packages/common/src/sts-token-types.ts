import type * as Wire from './wire-types.generated.js';
export type SigningAlgorithm = Wire.SigningAlgorithm;

// API key doesn't need account/project as it's determined from the key
export type ApiKeyTokenRequest = Wire.ApiKeyTokenRequest;

// User token needs optional account/project for scoping
export type UserTokenRequest = Wire.UserTokenRequest;

// Project token requires project_id and account_id
export type ProjectTokenRequest = Wire.ProjectTokenRequest;

// Environment token requires IDs - names fetched from DB
export type EnvironmentTokenRequest = Wire.EnvironmentTokenRequest;

/**
 * Agent token for a service account to act as agent on behalf of a user.
 *
 * Two trust paths are supported:
 *
 * - `user_access_token`: a live signed Vertesia token. STS verifies the user context from that token.
 * - `workload_id_token`: a workload acts on behalf of a user. It implies that a full verification
 *   will be performed based on the workload identity.
 */
export type AgentTokenRequest = Wire.AgentTokenRequest;

// Service account token
export type ServiceAccountTokenRequest = Wire.ServiceAccountTokenRequest;

/**
 * @discriminator type
 */
export type IssueTokenRequest = Wire.IssueTokenRequest;

export interface RefreshTokenRequest {
    token: string;
}

export interface RevokeTokenRequest {
    token: string;
}

// Response types
export interface TokenResponse {
    token: string;
    token_type?: string;
    expires_in?: number;
}

export type IssueTokenResponse = Wire.IssueTokenResponse;
export type IssueTokenForbiddenResponse = Wire.IssueTokenForbiddenResponse;

export interface ValidateTokenResponse {
    valid: boolean;
    payload?: unknown;
    error?: string;
}

export type IssueTokenUnavailableResponse = Wire.IssueTokenUnavailableResponse;

export type AppSessionTokenRequest = Wire.AppSessionTokenRequest;
export type AppSessionTokenResponse = Wire.AppSessionTokenResponse;
