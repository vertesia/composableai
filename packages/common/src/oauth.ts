import type { z } from 'zod';
import type {
    CreateOAuthProviderPayloadSchema,
    OAuthProviderAccessTokenResponseSchema,
    OAuthProviderAuthorizeResponseSchema,
    OAuthProviderAuthStatusSchema,
    OAuthProviderDataSchema,
    OAuthProviderExchangePayloadSchema,
    OAuthProviderSchema,
    UpdateOAuthProviderPayloadSchema,
} from './api-schemas/oauth.js';

/**
 * OAuth Provider types for generic, project-level OAuth 2.0 integration.
 * Decoupled from MCP — can be used by MCP collections, tool activities, or any OAuth-protected API.
 *
 * Every type below is inferred from `./api-schemas/oauth.js`, which is the object the OpenAPI
 * document and the request validator are both built from. `import type` throughout, so nothing here
 * pulls zod into a bundle that only wanted the types.
 */

/**
 * OAuth Provider data stored in MongoDB.
 * Represents the configuration for an OAuth 2.0 provider at the project level.
 */
export type OAuthProviderData = z.infer<typeof OAuthProviderDataSchema>;

/**
 * OAuth Provider as returned by the API (with id).
 */
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

/**
 * Payload for creating an OAuth Provider.
 * The client_secret is accepted as plaintext on create and stored encrypted.
 */
export type CreateOAuthProviderPayload = z.infer<typeof CreateOAuthProviderPayloadSchema>;

/**
 * Payload for updating an OAuth Provider.
 * All fields are optional — only provided fields are updated.
 * To clear the client_secret, set it to an empty string.
 */
export type UpdateOAuthProviderPayload = z.infer<typeof UpdateOAuthProviderPayloadSchema>;

/**
 * OAuth authentication status for a user against an OAuth Provider.
 */
export type OAuthProviderAuthStatus = z.infer<typeof OAuthProviderAuthStatusSchema>;

/**
 * Response from the OAuth authorize endpoint.
 * For authorization_code flow: contains authorization_url and state for browser redirect.
 * For client_credentials flow: contains connected=true (token was fetched server-side, no redirect needed).
 */
export type OAuthProviderAuthorizeResponse = z.infer<typeof OAuthProviderAuthorizeResponseSchema>;

export type OAuthProviderAccessTokenResponse = z.infer<typeof OAuthProviderAccessTokenResponseSchema>;

export type OAuthProviderExchangePayload = z.infer<typeof OAuthProviderExchangePayloadSchema>;
