import { z } from 'zod';

/**
 * The OAuth *provider* contracts: Vertesia acting as an OAuth CLIENT against a third-party
 * authorization server.
 *
 * The other direction — clients registered against Vertesia's own OAuth server, and the grants they
 * hold — is `./oauth-server.js`. The split mirrors the one the TypeScript declarations already had,
 * so each schema sits in the module its type came from and the canonical-alias map stays readable.
 */

/**
 * The success acknowledgement four provider endpoints and the client delete return.
 *
 * Here rather than in a module of its own because these five slots are its only callers, which is
 * the same reason `DeleteOperationResult` lives in `./apikey.js`. `common.ts` aliases the type so
 * `SuccessResponse` keeps being imported from where it always was.
 *
 * `z.boolean()`, not `z.literal(true)`, and that is what the document has always published: the
 * scanner widened the declared `success: true` to `type: boolean` on the way out. Publishing the
 * literal would newly forbid `{ success: false }` for every existing client, which is a contract
 * change this migration has no business making — the handlers return `true` either way.
 */
export const SuccessResponseSchema = z
    .strictObject({
        success: z.boolean(),
    })
    .meta({ id: 'SuccessResponse' });

/**
 * A provider's stored configuration, without its id.
 *
 * Split from {@link OAuthProviderSchema} because `OAuthProvider extends OAuthProviderData` in the
 * published types and both names are exported from the package. It carries no `id` in its meta, so
 * it is never a component of its own: the document has only ever published `OAuthProvider`, with
 * these properties inline and `id` last.
 */
export const OAuthProviderDataSchema = z.strictObject({
    name: z.string().meta({ description: 'Unique name within the project (kebab-case identifier).' }),
    display_name: z.string().meta({ description: 'Human-readable display name.' }),
    project: z.string().meta({ description: 'The project this OAuth provider belongs to.' }),
    grant_type: z
        .enum(['authorization_code', 'client_credentials'])
        .meta({
            description:
                "The OAuth 2.0 grant type to use.\n- 'authorization_code': 3-legged flow requiring user authorization (default).\n- 'client_credentials': 2-legged server-to-server flow using client_id + client_secret.",
        })
        .optional(),
    authorization_endpoint: z
        .string()
        .meta({
            description:
                'The OAuth 2.0 authorization endpoint URL. Only used for authorization_code flow. Optional when endpoints are discovered via .well-known (e.g. MCP servers).',
        })
        .optional(),
    token_endpoint: z
        .string()
        .meta({
            description:
                'The OAuth 2.0 token endpoint URL. Optional when endpoints are discovered via .well-known (e.g. MCP servers).',
        })
        .optional(),
    client_id: z.string().meta({ description: 'The OAuth client ID (always required).' }),
    has_client_secret: z
        .boolean()
        .meta({ description: 'Whether a client_secret is configured (never exposes the actual secret).' })
        .optional(),
    default_scopes: z
        .array(z.string())
        .meta({ description: 'Default scopes to request during authorization.' })
        .optional(),
    use_pkce: z.boolean().meta({
        description:
            'Whether to use PKCE (Proof Key for Code Exchange) in the authorization flow. Only applies to authorization_code flow. Defaults to true.',
    }),
    revocation_endpoint: z.string().meta({ description: 'Optional OAuth 2.0 revocation endpoint URL.' }).optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const OAuthProviderSchema = OAuthProviderDataSchema.extend({
    id: z.string(),
}).meta({ id: 'OAuthProvider', description: 'OAuth Provider as returned by the API (with id).' });

export const OAuthProviderArraySchema = z.array(OAuthProviderSchema).meta({ id: 'OAuthProviderArray' });

/**
 * What a create accepts, which is deliberately not what a read returns.
 *
 * `client_secret` goes IN and never comes back out: the read shape carries `has_client_secret`
 * instead. That request/response split is the rule for any component holding a credential, and
 * keeping the two schemas separate is what makes it structural rather than a convention the next
 * handler has to remember.
 */
export const CreateOAuthProviderPayloadSchema = z
    .strictObject({
        name: z.string(),
        display_name: z.string(),
        grant_type: z.enum(['authorization_code', 'client_credentials']).optional(),
        authorization_endpoint: z.string().optional(),
        token_endpoint: z.string().optional(),
        client_id: z.string(),
        client_secret: z
            .string()
            .meta({
                description:
                    'Optional client secret for confidential clients. Will be encrypted at rest and never returned in API responses.',
            })
            .optional(),
        default_scopes: z.array(z.string()).optional(),
        use_pkce: z.boolean().optional(),
        revocation_endpoint: z.string().optional(),
    })
    .meta({
        id: 'CreateOAuthProviderPayload',
        description:
            'Payload for creating an OAuth Provider. The client_secret is accepted as plaintext on create and stored encrypted.',
    });

/**
 * `.partial()` of the create payload, which is what `Partial<CreateOAuthProviderPayload>` said and
 * what the handler does — it writes only the fields the body names.
 *
 * The document changes shape here without changing meaning. The scanner published this as a `$ref`
 * to a component it invented called `Partial_CreateOAuthProviderPayload`; a canonical component is
 * defined where it is named, so the properties are now inline under `UpdateOAuthProviderPayload` and
 * the invented name is gone. Same properties, same order, same optionality — one fewer model in the
 * generated clients.
 */
export const UpdateOAuthProviderPayloadSchema = CreateOAuthProviderPayloadSchema.partial().meta({
    id: 'UpdateOAuthProviderPayload',
    description:
        'Payload for updating an OAuth Provider. All fields are optional — only provided fields are updated. To clear the client_secret, set it to an empty string.',
});

export const OAuthProviderAuthStatusSchema = z
    .strictObject({
        oauth_provider_id: z.string(),
        oauth_provider_name: z.string(),
        authenticated: z.boolean(),
        expires_at: z.string().optional(),
        scope: z.string().optional(),
    })
    .meta({
        id: 'OAuthProviderAuthStatus',
        description: 'OAuth authentication status for a user against an OAuth Provider.',
    });

export const OAuthProviderAuthorizeResponseSchema = z
    .strictObject({
        authorization_url: z.string().optional(),
        state: z.string().optional(),
        connected: z.boolean().optional(),
    })
    .meta({
        id: 'OAuthProviderAuthorizeResponse',
        description:
            'Response from the OAuth authorize endpoint. For authorization_code flow: contains authorization_url and state for browser redirect. For client_credentials flow: contains connected=true (token was fetched server-side, no redirect needed).',
    });

export const OAuthProviderAccessTokenResponseSchema = z
    .strictObject({
        access_token: z.string(),
    })
    .meta({ id: 'OAuthProviderAccessTokenResponse' });

export const OAuthProviderExchangePayloadSchema = z
    .strictObject({
        code: z.string(),
        state: z.string(),
    })
    .meta({ id: 'OAuthProviderExchangePayload' });
