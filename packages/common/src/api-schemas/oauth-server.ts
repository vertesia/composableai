import { z } from 'zod';

/**
 * The contracts for Vertesia's OWN OAuth server: the clients registered against it and the grants
 * their users have approved. Vertesia acting as a client of someone else's authorization server is
 * `./oauth.js`.
 *
 * This module also owns the token server's public authorize, token, device-code, consent, and
 * discovery wire contracts. Standard OAuth responses remain extensible so clients can ignore
 * additional response parameters as required by OAuth; Vertesia-specific request and response
 * objects are strict.
 */

export const OAuthClientTypeSchema = z.enum(['public', 'confidential']).meta({ id: 'OAuthClientType' });

export const OAuthClientStatusSchema = z.enum(['active', 'disabled']).meta({ id: 'OAuthClientStatus' });

export const OAuthRegistrationSourceSchema = z.enum(['admin', 'dynamic']).meta({ id: 'OAuthRegistrationSource' });

export const OAuthProjectBindingModeSchema = z.enum(['user_select', 'fixed']).meta({ id: 'OAuthProjectBindingMode' });

export const OAuthTokenEndpointAuthMethodSchema = z
    .enum(['none', 'client_secret_post', 'client_secret_basic'])
    .meta({ id: 'OAuthTokenEndpointAuthMethod' });

export const OAuthGrantTypeSchema = z
    .enum(['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'])
    .meta({ id: 'OAuthGrantType' });

export const OAuthResponseTypeSchema = z.literal('code').meta({ id: 'OAuthResponseType' });

export const OAuthAuthorizationRequestStatusSchema = z
    .enum(['pending', 'denied', 'consumed'])
    .meta({ id: 'OAuthAuthorizationRequestStatus' });

export const OAuthClientRegistrationModeSchema = z
    .enum(['registered', 'client_id_metadata_document'])
    .meta({ id: 'OAuthClientRegistrationMode' });

export const OAuthGrantStatusSchema = z.enum(['active', 'revoked', 'expired']).meta({ id: 'OAuthGrantStatus' });

export const OAuthGrantSortFieldSchema = z
    .enum(['granted_at', 'client_name', 'user_name', 'resource', 'last_used_at', 'expires_at', 'status'])
    .meta({ id: 'OAuthGrantSortField' });

export const OAuthGrantSortOrderSchema = z.enum(['asc', 'desc']).meta({ id: 'OAuthGrantSortOrder' });

/** RFC 8414 metadata is extensible; parsing keeps the standardized fields and ignores extensions. */
export const OAuthAuthorizationServerMetadataSchema = z
    .object({
        issuer: z.string(),
        authorization_endpoint: z.string(),
        token_endpoint: z.string(),
        jwks_uri: z.string(),
        registration_endpoint: z.string().optional(),
        revocation_endpoint: z.string().optional(),
        response_types_supported: z.array(z.string()),
        grant_types_supported: z.array(z.string()),
        code_challenge_methods_supported: z.array(z.string()),
        token_endpoint_auth_methods_supported: z.array(z.string()),
        scopes_supported: z.array(z.string()),
        client_id_metadata_document_supported: z.boolean().optional(),
        authorization_response_iss_parameter_supported: z.boolean().optional(),
        device_authorization_endpoint: z.string().optional(),
    })
    .meta({ id: 'OAuthAuthorizationServerMetadata' });

export const OAuthClientDisplayMetadataSchema = z
    .strictObject({
        client_uri: z.string().optional(),
        logo_uri: z.string().optional(),
        tos_uri: z.string().optional(),
        policy_uri: z.string().optional(),
    })
    .meta({ id: 'OAuthClientDisplayMetadata' });

const oauthAuthorizeQueryFields = {
    response_type: OAuthResponseTypeSchema,
    client_id: z.string(),
    redirect_uri: z.string(),
    resource: z.string().optional(),
    scope: z.string().optional(),
    state: z.string().optional(),
    code_challenge: z.string(),
    code_challenge_method: z.literal('S256'),
    project_id: z.string().optional(),
};

export const OAuthAuthorizeQuerySchema = z.strictObject(oauthAuthorizeQueryFields).meta({ id: 'OAuthAuthorizeQuery' });

export const CreateOAuthAuthorizationRequestPayloadSchema = z
    .strictObject(oauthAuthorizeQueryFields)
    .meta({ id: 'CreateOAuthAuthorizationRequestPayload' });

export const OAuthAuthorizationRequestSchema = z
    .strictObject({
        request_id: z.string(),
        client_id: z.string(),
        client_name: z.string(),
        client_metadata: OAuthClientDisplayMetadataSchema.optional(),
        client_registration_mode: OAuthClientRegistrationModeSchema.optional(),
        redirect_uri: z.string(),
        redirect_origin: z.string(),
        resource: z.string().optional(),
        requested_scopes: z.array(z.string()),
        optional_scopes: z.array(z.string()).optional(),
        requested_project_id: z.string().optional(),
        project_binding_mode: OAuthProjectBindingModeSchema,
        fixed_project_id: z.string().optional(),
        restrict_to_owner_account: z.boolean().optional().meta({
            description:
                'When true, consent must be limited to projects in the OAuth client owning account. False allows any project the approving user can access.',
        }),
        owner_account_id: z
            .string()
            .optional()
            .meta({ description: 'Owning account enforced when restrict_to_owner_account is true.' }),
        consent_required: z.boolean().optional().meta({
            description:
                'False when the authorization server has determined this client may be approved without showing a consent screen. Absent or true means consent must be collected from the user. Granted scopes are clamped to the user permissions by the server in either case, so this controls only whether the user is prompted.',
        }),
        status: OAuthAuthorizationRequestStatusSchema,
        created_at: z.string(),
        expires_at: z.string(),
    })
    .meta({ id: 'OAuthAuthorizationRequest' });

export const ApproveOAuthAuthorizationRequestPayloadSchema = z
    .strictObject({
        project_id: z.string().optional(),
        granted_scopes: z.array(z.string()),
    })
    .meta({ id: 'ApproveOAuthAuthorizationRequestPayload' });

export const OAuthGrantableScopesResponseSchema = z
    .strictObject({
        project_id: z.string(),
        requested_permission_scopes: z.array(z.string()),
        grantable_permission_scopes: z.array(z.string()),
        unavailable_permission_scopes: z.array(z.string()),
    })
    .meta({ id: 'OAuthGrantableScopesResponse' });

export const OAuthAuthorizationDecisionResponseSchema = z
    .strictObject({
        redirect_url: z.string(),
    })
    .meta({ id: 'OAuthAuthorizationDecisionResponse' });

export const OAuthDeviceAuthorizationRequestSchema = z
    .strictObject({
        client_id: z.string(),
        resource: z.string().optional(),
        scope: z.string().optional(),
        project_id: z.string().optional(),
    })
    .meta({ id: 'OAuthDeviceAuthorizationRequest' });

/** RFC 8628 responses can gain extension parameters; consumers parse the standardized fields. */
export const OAuthDeviceAuthorizationResponseSchema = z
    .object({
        device_code: z.string(),
        user_code: z.string(),
        verification_uri: z.string(),
        verification_uri_complete: z.string(),
        expires_in: z.number(),
        interval: z.number(),
    })
    .meta({ id: 'OAuthDeviceAuthorizationResponse' });

/** RFC 6749 requires clients to ignore unrecognized token response parameters. */
export const OAuthTokenResponseSchema = z
    .object({
        access_token: z.string(),
        token_type: z.string().regex(/^bearer$/i),
        expires_in: z.number(),
        scope: z.string().optional(),
        refresh_token: z.string().optional(),
        /**
         * Lifetime in seconds of `refresh_token`, from the moment this response was issued.
         *
         * Not an RFC 6749 parameter — refresh tokens there are opaque and undated — but clients that
         * persist the token need it to report when the stored credential dies. Every refresh token
         * this server returns is newly minted (the refresh grant rotates), so this is always the full
         * lifetime and never a remaining one.
         */
        refresh_token_expires_in: z.number().optional(),
        id_token: z.string().optional(),
    })
    .meta({ id: 'OAuthTokenResponse' });

/**
 * A client's registration, without its issued id.
 *
 * Split from {@link OAuthClientSchema} because `OAuthClient extends OAuthClientData` in the published
 * types and both names are exported. No `id` in its meta, so it is never a component: the document
 * publishes these properties inline under `OAuthClient`, with `client_id` last.
 */
export const OAuthClientDataSchema = z.strictObject({
    client_name: z.string(),
    client_type: OAuthClientTypeSchema,
    redirect_uris: z.array(z.string()),
    grant_types: z.array(OAuthGrantTypeSchema),
    response_types: z.array(OAuthResponseTypeSchema),
    token_endpoint_auth_method: OAuthTokenEndpointAuthMethodSchema,
    allowed_scopes: z.array(z.string()),
    default_scopes: z.array(z.string()).optional(),
    registration_source: OAuthRegistrationSourceSchema,
    status: OAuthClientStatusSchema,
    project_binding_mode: OAuthProjectBindingModeSchema,
    fixed_project_id: z.string().optional(),
    restrict_to_owner_account: z
        .boolean()
        .meta({
            description:
                'When true (the default for new clients), the client may only be authorized for projects in its owning account/organization. Set to false to allow authorization for any project the approving user can access, regardless of account — required for OAuth/MCP clients used across organizations. The owning account itself is internal and not exposed here.',
        })
        .optional(),
    metadata: z.looseObject({}).optional(),
    created_by: z.string().optional(),
    client_secret_configured: z.boolean().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const OAuthClientSchema = OAuthClientDataSchema.extend({
    client_id: z.string(),
}).meta({ id: 'OAuthClient' });

export const OAuthClientArraySchema = z.array(OAuthClientSchema).meta({ id: 'OAuthClientArray' });

/**
 * The create response, which is the read shape plus the one field that is never readable again.
 *
 * `client_secret` is returned exactly once, by the call that generates it; every later read of the
 * same client publishes `client_secret_configured` instead. Two components rather than one optional
 * field on `OAuthClient` is what keeps that one-time disclosure visible in the document.
 */
export const OAuthClientCreateResponseSchema = OAuthClientSchema.extend({
    client_secret: z.string().optional(),
}).meta({ id: 'OAuthClientCreateResponse' });

export const OAuthClientScopeMetadataSchema = z
    .strictObject({
        supported_scopes: z.array(z.string()),
    })
    .meta({ id: 'OAuthClientScopeMetadata' });

export const CreateOAuthClientPayloadSchema = z
    .strictObject({
        client_name: z.string(),
        client_type: OAuthClientTypeSchema.optional(),
        redirect_uris: z.array(z.string()),
        grant_types: z.array(OAuthGrantTypeSchema).optional(),
        response_types: z.array(OAuthResponseTypeSchema).optional(),
        token_endpoint_auth_method: OAuthTokenEndpointAuthMethodSchema.optional(),
        allowed_scopes: z.array(z.string()).optional(),
        default_scopes: z.array(z.string()).optional(),
        project_binding_mode: OAuthProjectBindingModeSchema.optional(),
        fixed_project_id: z.string().optional(),
        restrict_to_owner_account: z.boolean().optional(),
        client_secret: z.string().optional(),
        metadata: z.looseObject({}).optional(),
    })
    .meta({ id: 'CreateOAuthClientPayload' });

/**
 * Not `.partial()` of the create payload, and the difference is deliberate rather than an oversight
 * to tidy up: an update accepts `status`, which a create does not (a new client is always `active`),
 * and cannot accept `client_type`, which is fixed at registration because the auth method and secret
 * are decided from it. Deriving one from the other would publish both of those wrong.
 */
export const UpdateOAuthClientPayloadSchema = z
    .strictObject({
        client_name: z.string().optional(),
        redirect_uris: z.array(z.string()).optional(),
        grant_types: z.array(OAuthGrantTypeSchema).optional(),
        response_types: z.array(OAuthResponseTypeSchema).optional(),
        token_endpoint_auth_method: OAuthTokenEndpointAuthMethodSchema.optional(),
        allowed_scopes: z.array(z.string()).optional(),
        default_scopes: z.array(z.string()).optional(),
        status: OAuthClientStatusSchema.optional(),
        project_binding_mode: OAuthProjectBindingModeSchema.optional(),
        fixed_project_id: z.string().optional(),
        restrict_to_owner_account: z.boolean().optional(),
        client_secret: z.string().optional(),
        metadata: z.looseObject({}).optional(),
    })
    .meta({ id: 'UpdateOAuthClientPayload' });

export const OAuthGrantSchema = z
    .strictObject({
        grant_id: z.string(),
        client_id: z.string(),
        client_name: z.string(),
        user_id: z.string(),
        user_name: z.string().optional(),
        user_email: z.string().optional(),
        account_id: z.string(),
        project_id: z.string(),
        resource: z.string(),
        scope: z.array(z.string()),
        status: OAuthGrantStatusSchema,
        token_count: z.number(),
        granted_at: z.string(),
        created_at: z.string(),
        last_used_at: z.string().optional(),
        expires_at: z.string().optional(),
    })
    .meta({ id: 'OAuthGrant' });

/**
 * What `?status=` accepts: every {@link OAuthGrantStatusSchema} member, plus `all` for "do not filter".
 *
 * Written out rather than composed from the status enum, because the two are published differently
 * and have to be: a query parameter is expanded inline, so a union would reach the document as an
 * `anyOf` of a `$ref` and a `const` — a shape no generator turns into a usable enum, and one this
 * parameter has never had. `oauth-grant-status-filter.test.ts` pins the members to the status enum
 * plus the sentinel so the two cannot drift apart silently.
 */
const OAuthGrantStatusFilterSchema = z.enum(['active', 'revoked', 'expired', 'all']);

/**
 * The listing filters, shared with the bulk revoke body because `BulkRevokeOAuthGrantsPayload
 * extends ListOAuthGrantsQuery` — selecting grants to revoke is selecting grants to list, and two
 * copies of ten filters would be two chances for the selection to mean something different from the
 * preview the caller looked at.
 */
const oauthGrantFilterFields = {
    account_id: z.string().optional(),
    project_id: z.string().optional(),
    user_id: z.string().optional(),
    client_id: z.string().optional(),
    resource: z.string().optional(),
    status: OAuthGrantStatusFilterSchema.optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sort_by: OAuthGrantSortFieldSchema.optional(),
    sort_order: OAuthGrantSortOrderSchema.optional(),
};

export const ListOAuthGrantsQuerySchema = z.strictObject(oauthGrantFilterFields).meta({ id: 'ListOAuthGrantsQuery' });

export const RevokeOAuthGrantQuerySchema = z
    .strictObject({
        include_consent: z.boolean().optional(),
    })
    .meta({ id: 'RevokeOAuthGrantQuery' });

export const BulkRevokeOAuthGrantsPayloadSchema = z
    .strictObject({
        ...oauthGrantFilterFields,
        grant_ids: z.array(z.string()).optional(),
        include_consent: z.boolean().optional(),
    })
    .meta({ id: 'BulkRevokeOAuthGrantsPayload' });

export const OAuthGrantListResponseSchema = z
    .strictObject({
        grants: z.array(OAuthGrantSchema),
        total_count: z.number(),
        limit: z.number(),
        offset: z.number(),
    })
    .meta({ id: 'OAuthGrantListResponse' });

export const OAuthGrantRevokeResponseSchema = z
    .strictObject({
        revoked_tokens: z.number(),
        revoked_consents: z.number(),
    })
    .meta({ id: 'OAuthGrantRevokeResponse' });
