import type * as Wire from './wire-types.generated.js';

/**
 * These public OAuth wire types are inferred from `./api-schemas/oauth-server.js` — the same
 * contracts used for runtime parsing and OpenAPI components.
 */
export type OAuthClientType = Wire.OAuthClientType;
export type OAuthClientStatus = Wire.OAuthClientStatus;
export type OAuthRegistrationSource = Wire.OAuthRegistrationSource;
export type OAuthProjectBindingMode = Wire.OAuthProjectBindingMode;
export type OAuthTokenEndpointAuthMethod = Wire.OAuthTokenEndpointAuthMethod;
export type OAuthGrantType = Wire.OAuthGrantType;
export type OAuthResponseType = Wire.OAuthResponseType;
export type OAuthAuthorizationRequestStatus = Wire.OAuthAuthorizationRequestStatus;
export type OAuthClientRegistrationMode = Wire.OAuthClientRegistrationMode;
export type OAuthGrantStatus = Wire.OAuthGrantStatus;
export type OAuthGrantSortField = Wire.OAuthGrantSortField;
export type OAuthGrantSortOrder = Wire.OAuthGrantSortOrder;

/** An OAuth client's registration, without the id the server issues for it. */
export type OAuthClientData = Wire.OAuthClientData;

export type OAuthClient = Wire.OAuthClient;

/** The read shape plus the client secret, which is returned by the create call and never again. */
export type OAuthClientCreateResponse = Wire.OAuthClientCreateResponse;

export type OAuthClientScopeMetadata = Wire.OAuthClientScopeMetadata;

export type OAuthGrant = Wire.OAuthGrant;

export type ListOAuthGrantsQuery = Wire.ListOAuthGrantsQuery;

/** Whether revoking a grant also withdraws the stored consent behind it. */
export type RevokeOAuthGrantQuery = Wire.RevokeOAuthGrantQuery;

export type OAuthGrantListResponse = Wire.OAuthGrantListResponse;

export type BulkRevokeOAuthGrantsPayload = Wire.BulkRevokeOAuthGrantsPayload;

export type OAuthGrantRevokeResponse = Wire.OAuthGrantRevokeResponse;

export type CreateOAuthClientPayload = Wire.CreateOAuthClientPayload;

export type UpdateOAuthClientPayload = Wire.UpdateOAuthClientPayload;

export type OAuthAuthorizationServerMetadata = Wire.OAuthAuthorizationServerMetadata;
export type OAuthClientDisplayMetadata = Wire.OAuthClientDisplayMetadata;
export type OAuthAuthorizeQuery = Wire.OAuthAuthorizeQuery;
export type CreateOAuthAuthorizationRequestPayload = Wire.CreateOAuthAuthorizationRequestPayload;
export type OAuthAuthorizationRequest = Wire.OAuthAuthorizationRequest;
export type ApproveOAuthAuthorizationRequestPayload = Wire.ApproveOAuthAuthorizationRequestPayload;
export type OAuthGrantableScopesResponse = Wire.OAuthGrantableScopesResponse;
export type OAuthAuthorizationDecisionResponse = Wire.OAuthAuthorizationDecisionResponse;
export type OAuthDeviceAuthorizationRequest = Wire.OAuthDeviceAuthorizationRequest;
export type OAuthDeviceAuthorizationResponse = Wire.OAuthDeviceAuthorizationResponse;
export type OAuthTokenResponse = Wire.OAuthTokenResponse;

export type OAuthAuthorizationRequestGeneratedApp = Wire.OAuthAuthorizationRequestGeneratedApp;

export type OAuthLoginPayload = Wire.OAuthLoginPayload;
export type OAuthLoginDecisionResponse = Wire.OAuthLoginDecisionResponse;

export type OAuthLoginUserNotFoundResponse = Wire.OAuthLoginUserNotFoundResponse;
