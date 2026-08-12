import type { z } from 'zod';
import type {
    ApproveOAuthAuthorizationRequestPayloadSchema,
    BulkRevokeOAuthGrantsPayloadSchema,
    CreateOAuthAuthorizationRequestPayloadSchema,
    CreateOAuthClientPayloadSchema,
    ListOAuthGrantsQuerySchema,
    OAuthAuthorizationDecisionResponseSchema,
    OAuthAuthorizationRequestSchema,
    OAuthAuthorizationRequestStatusSchema,
    OAuthAuthorizationServerMetadataSchema,
    OAuthAuthorizeQuerySchema,
    OAuthClientCreateResponseSchema,
    OAuthClientDataSchema,
    OAuthClientDisplayMetadataSchema,
    OAuthClientRegistrationModeSchema,
    OAuthClientSchema,
    OAuthClientScopeMetadataSchema,
    OAuthClientStatusSchema,
    OAuthClientTypeSchema,
    OAuthDeviceAuthorizationRequestSchema,
    OAuthDeviceAuthorizationResponseSchema,
    OAuthGrantableScopesResponseSchema,
    OAuthGrantListResponseSchema,
    OAuthGrantRevokeResponseSchema,
    OAuthGrantSchema,
    OAuthGrantSortFieldSchema,
    OAuthGrantSortOrderSchema,
    OAuthGrantStatusSchema,
    OAuthGrantTypeSchema,
    OAuthProjectBindingModeSchema,
    OAuthRegistrationSourceSchema,
    OAuthResponseTypeSchema,
    OAuthTokenEndpointAuthMethodSchema,
    OAuthTokenResponseSchema,
    RevokeOAuthGrantQuerySchema,
    UpdateOAuthClientPayloadSchema,
} from './api-schemas/oauth-server.js';

/**
 * These public OAuth wire types are inferred from `./api-schemas/oauth-server.js` — the same
 * contracts used for runtime parsing and OpenAPI components.
 */
export type OAuthClientType = z.infer<typeof OAuthClientTypeSchema>;
export type OAuthClientStatus = z.infer<typeof OAuthClientStatusSchema>;
export type OAuthRegistrationSource = z.infer<typeof OAuthRegistrationSourceSchema>;
export type OAuthProjectBindingMode = z.infer<typeof OAuthProjectBindingModeSchema>;
export type OAuthTokenEndpointAuthMethod = z.infer<typeof OAuthTokenEndpointAuthMethodSchema>;
export type OAuthGrantType = z.infer<typeof OAuthGrantTypeSchema>;
export type OAuthResponseType = z.infer<typeof OAuthResponseTypeSchema>;
export type OAuthAuthorizationRequestStatus = z.infer<typeof OAuthAuthorizationRequestStatusSchema>;
export type OAuthClientRegistrationMode = z.infer<typeof OAuthClientRegistrationModeSchema>;
export type OAuthGrantStatus = z.infer<typeof OAuthGrantStatusSchema>;
export type OAuthGrantSortField = z.infer<typeof OAuthGrantSortFieldSchema>;
export type OAuthGrantSortOrder = z.infer<typeof OAuthGrantSortOrderSchema>;

/** An OAuth client's registration, without the id the server issues for it. */
export type OAuthClientData = z.infer<typeof OAuthClientDataSchema>;

export type OAuthClient = z.infer<typeof OAuthClientSchema>;

/** The read shape plus the client secret, which is returned by the create call and never again. */
export type OAuthClientCreateResponse = z.infer<typeof OAuthClientCreateResponseSchema>;

export type OAuthClientScopeMetadata = z.infer<typeof OAuthClientScopeMetadataSchema>;

export type OAuthGrant = z.infer<typeof OAuthGrantSchema>;

export type ListOAuthGrantsQuery = z.infer<typeof ListOAuthGrantsQuerySchema>;

/** Whether revoking a grant also withdraws the stored consent behind it. */
export type RevokeOAuthGrantQuery = z.infer<typeof RevokeOAuthGrantQuerySchema>;

export type OAuthGrantListResponse = z.infer<typeof OAuthGrantListResponseSchema>;

export type BulkRevokeOAuthGrantsPayload = z.infer<typeof BulkRevokeOAuthGrantsPayloadSchema>;

export type OAuthGrantRevokeResponse = z.infer<typeof OAuthGrantRevokeResponseSchema>;

export type CreateOAuthClientPayload = z.infer<typeof CreateOAuthClientPayloadSchema>;

export type UpdateOAuthClientPayload = z.infer<typeof UpdateOAuthClientPayloadSchema>;

export type OAuthAuthorizationServerMetadata = z.infer<typeof OAuthAuthorizationServerMetadataSchema>;
export type OAuthClientDisplayMetadata = z.infer<typeof OAuthClientDisplayMetadataSchema>;
export type OAuthAuthorizeQuery = z.infer<typeof OAuthAuthorizeQuerySchema>;
export type CreateOAuthAuthorizationRequestPayload = z.infer<typeof CreateOAuthAuthorizationRequestPayloadSchema>;
export type OAuthAuthorizationRequest = z.infer<typeof OAuthAuthorizationRequestSchema>;
export type ApproveOAuthAuthorizationRequestPayload = z.infer<typeof ApproveOAuthAuthorizationRequestPayloadSchema>;
export type OAuthGrantableScopesResponse = z.infer<typeof OAuthGrantableScopesResponseSchema>;
export type OAuthAuthorizationDecisionResponse = z.infer<typeof OAuthAuthorizationDecisionResponseSchema>;
export type OAuthDeviceAuthorizationRequest = z.infer<typeof OAuthDeviceAuthorizationRequestSchema>;
export type OAuthDeviceAuthorizationResponse = z.infer<typeof OAuthDeviceAuthorizationResponseSchema>;
export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;
