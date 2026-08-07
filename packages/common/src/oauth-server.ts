import type { z } from 'zod';
import type {
    BulkRevokeOAuthGrantsPayloadSchema,
    CreateOAuthClientPayloadSchema,
    ListOAuthGrantsQuerySchema,
    OAuthClientCreateResponseSchema,
    OAuthClientDataSchema,
    OAuthClientSchema,
    OAuthClientScopeMetadataSchema,
    OAuthClientStatusSchema,
    OAuthClientTypeSchema,
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
    RevokeOAuthGrantQuerySchema,
    UpdateOAuthClientPayloadSchema,
} from './api-schemas/oauth-server.js';

/**
 * The types the three studio OAuth resources publish are inferred from
 * `./api-schemas/oauth-server.js` — the same objects the OpenAPI document and the request validator
 * are built from. The rest of this module is the token server's own OAuth surface, still declared
 * here and still TypeScript-derived; it converts with that service's own slots.
 */
export type OAuthClientType = z.infer<typeof OAuthClientTypeSchema>;
export type OAuthClientStatus = z.infer<typeof OAuthClientStatusSchema>;
export type OAuthRegistrationSource = z.infer<typeof OAuthRegistrationSourceSchema>;
export type OAuthProjectBindingMode = z.infer<typeof OAuthProjectBindingModeSchema>;
export type OAuthTokenEndpointAuthMethod = z.infer<typeof OAuthTokenEndpointAuthMethodSchema>;
export type OAuthGrantType = z.infer<typeof OAuthGrantTypeSchema>;
export type OAuthResponseType = z.infer<typeof OAuthResponseTypeSchema>;
type OAuthAuthorizationRequestStatus = 'pending' | 'denied' | 'consumed';
export type OAuthClientRegistrationMode = 'registered' | 'client_id_metadata_document';
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

export interface OAuthAuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    registration_endpoint?: string;
    revocation_endpoint?: string;
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    scopes_supported: string[];
    client_id_metadata_document_supported?: boolean;
    device_authorization_endpoint?: string;
}

export interface OAuthClientDisplayMetadata {
    client_uri?: string;
    logo_uri?: string;
    tos_uri?: string;
    policy_uri?: string;
}

export interface OAuthAuthorizeQuery {
    response_type: 'code';
    client_id: string;
    redirect_uri: string;
    resource?: string;
    scope?: string;
    state?: string;
    code_challenge: string;
    code_challenge_method: 'S256';
    project_id?: string;
}

export interface CreateOAuthAuthorizationRequestPayload extends OAuthAuthorizeQuery {}

export interface OAuthAuthorizationRequest {
    request_id: string;
    client_id: string;
    client_name: string;
    client_metadata?: OAuthClientDisplayMetadata;
    client_registration_mode?: OAuthClientRegistrationMode;
    redirect_uri: string;
    redirect_origin: string;
    resource?: string;
    requested_scopes: string[];
    optional_scopes?: string[];
    requested_project_id?: string;
    project_binding_mode: OAuthProjectBindingMode;
    fixed_project_id?: string;
    /**
     * When true, the consent UI must constrain project selection to {@link owner_account_id}: the
     * client may only be authorized for projects in its owning account. False (default) lets the user
     * authorize any project they can access. Mirrors the server-side authorization enforcement.
     */
    restrict_to_owner_account?: boolean;
    /** The owning account the client is restricted to, when {@link restrict_to_owner_account} is true. */
    owner_account_id?: string;
    status: OAuthAuthorizationRequestStatus;
    created_at: string;
    expires_at: string;
}

export interface ApproveOAuthAuthorizationRequestPayload {
    project_id?: string;
    granted_scopes: string[];
}

export interface OAuthGrantableScopesResponse {
    project_id: string;
    requested_permission_scopes: string[];
    grantable_permission_scopes: string[];
    unavailable_permission_scopes: string[];
}

export interface OAuthAuthorizationDecisionResponse {
    redirect_url: string;
}

export interface OAuthDeviceAuthorizationRequest {
    client_id: string;
    resource?: string;
    scope?: string;
    project_id?: string;
}

export interface OAuthDeviceAuthorizationResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}

export interface OAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    refresh_token?: string;
    id_token?: string;
}
