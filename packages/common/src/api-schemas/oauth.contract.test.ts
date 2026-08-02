import { describe, expect, it } from 'vitest';
import { OAuthGrantStatusSchema } from './oauth-server.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

/**
 * The OAuth contracts, pinned where converting them changed what the document says or where the
 * conversion had a choice to make.
 *
 * The provider/client/grant closure is 30 components and almost all of it re-emits byte-identically;
 * what is asserted here is the handful of places it does not, plus the request/response secret split
 * that is the reason these components are shaped the way they are.
 */

describe('the OAuth grant status filter', () => {
    /**
     * `?status=` takes the grant statuses plus `all`, and the query schema spells all four out rather
     * than composing them, because a union would reach the document as an `anyOf` of a `$ref` and a
     * `const` once the parameter is expanded. That leaves two lists that have to agree, so this is
     * the assertion that they do: adding a fourth grant status without adding it to the filter would
     * publish a status the caller cannot filter for.
     */
    it('offers every grant status, plus the all sentinel', () => {
        expect(statusEnumOf('ListOAuthGrantsQuery')).toEqual([...OAuthGrantStatusSchema.options, 'all']);
    });

    it('is the same list on the bulk revoke body as on the listing query', () => {
        // Revoking in bulk selects grants exactly the way listing them does — a filter that meant
        // something different from the preview the caller looked at is the failure mode here.
        expect(statusEnumOf('BulkRevokeOAuthGrantsPayload')).toEqual(statusEnumOf('ListOAuthGrantsQuery'));
    });

    it('rejects a status that is neither, rather than listing everything', () => {
        expect(validateApiRequest('BulkRevokeOAuthGrantsPayload', { status: 'pending' }).valid).toBe(false);
        expect(validateApiRequest('BulkRevokeOAuthGrantsPayload', { status: 'all' }).valid).toBe(true);
    });
});

describe('the OAuth provider secret boundary', () => {
    it('accepts a client secret on create', () => {
        expect(
            validateApiRequest('CreateOAuthProviderPayload', {
                name: 'acme',
                display_name: 'Acme',
                client_id: 'client-123',
                client_secret: 'shhh',
            }),
        ).toMatchObject({ valid: true });
    });

    it('refuses to publish one on the way back out', () => {
        // The read shape says whether a secret exists and nothing more. `additionalProperties: false`
        // is what turns a mapper that spread the document into a failed response instead of a leak.
        const response = {
            id: '68b1779130afe5403a1589ba',
            name: 'acme',
            display_name: 'Acme',
            project: '69d4762f24d3048c99149d0b',
            client_id: 'client-123',
            has_client_secret: true,
            use_pkce: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        };

        expect(validateApiResponse('OAuthProvider', response)).toMatchObject({ valid: true });
        expect(validateApiResponse('OAuthProvider', { ...response, client_secret: 'shhh' }).valid).toBe(false);
    });

    it('publishes the client secret on the create response only', () => {
        // The one call that generates it returns it once; every later read of the same client gets
        // `client_secret_configured`. Two components rather than one optional field is what keeps
        // that visible in the document.
        const client = {
            client_id: 'vts_abc',
            client_name: 'Acme CLI',
            client_type: 'public',
            redirect_uris: ['https://acme.example/callback'],
            grant_types: ['authorization_code'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            allowed_scopes: ['openid'],
            registration_source: 'admin',
            status: 'active',
            project_binding_mode: 'user_select',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        };

        expect(validateApiResponse('OAuthClientCreateResponse', { ...client, client_secret: 'vss_x' })).toMatchObject({
            valid: true,
        });
        expect(validateApiResponse('OAuthClient', { ...client, client_secret: 'vss_x' }).valid).toBe(false);
    });
});

describe('UpdateOAuthProviderPayload', () => {
    /**
     * The scanner published this as a `$ref` to an invented `Partial_CreateOAuthProviderPayload`. A
     * canonical component is defined where it is named, so the properties are inline now and the
     * invented name is gone — same properties, same optionality, one fewer model downstream.
     */
    it('is defined in place, with no Partial_ component left behind', () => {
        expect(ApiSchemaComponents).toHaveProperty('UpdateOAuthProviderPayload');
        expect(ApiSchemaComponents).not.toHaveProperty('Partial_CreateOAuthProviderPayload');
        expect(JSON.stringify(ApiSchemaComponents)).not.toContain('Partial_CreateOAuthProviderPayload');
    });

    it('accepts an empty body and a single-field body, and still rejects a typo', () => {
        expect(validateApiRequest('UpdateOAuthProviderPayload', {}).valid).toBe(true);
        expect(validateApiRequest('UpdateOAuthProviderPayload', { display_name: 'Acme' }).valid).toBe(true);
        expect(validateApiRequest('UpdateOAuthProviderPayload', { displayName: 'Acme' }).valid).toBe(false);
    });
});

/**
 * A component's `status` enum, as the registry emits it.
 *
 * Read off the component rather than off a generated document: generating one needs the scanner,
 * which is a package this one does not depend on. The expansion of a query component into parameters
 * inlines exactly this, and has its own tests in `parameters.test.ts`.
 */
function statusEnumOf(component: 'ListOAuthGrantsQuery' | 'BulkRevokeOAuthGrantsPayload'): string[] {
    const emitted = ApiSchemaComponents[component] as { properties?: Record<string, { enum?: unknown }> } | undefined;
    const status = emitted?.properties?.status;
    if (!Array.isArray(status?.enum)) {
        throw new Error(`${component} does not publish status as an inline enum`);
    }
    return status.enum as string[];
}
