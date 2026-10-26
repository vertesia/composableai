import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';

const request = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: 'signed-jwt',
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    federation_connection_id: '012345678901234567890123',
    project_id: '012345678901234567890124',
    resource: 'https://api.example.com/',
    scope: 'content:read',
};
describe('OIDC federation wire contracts', () => {
    it('accepts secretless exchanges and rejects missing selectors and unsupported token requests', () => {
        expect(validateApiRequest('OAuthTokenExchangeRequest', request).valid).toBe(true);
        const { scope: _scope, ...defaultRequest } = request;
        expect(validateApiRequest('OAuthTokenExchangeRequest', defaultRequest).valid).toBe(true);
        expect(validateApiRequest('OAuthTokenExchangeRequest', { ...request, scope: '' }).valid).toBe(false);
        for (const credentials of [
            { client_id: 'integration', client_secret: 'secret' },
            {
                client_id: 'integration',
                client_assertion: 'signed',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            },
        ]) {
            expect(validateApiRequest('OAuthTokenExchangeRequest', { ...request, ...credentials }).valid).toBe(true);
        }
        expect(validateApiRequest('OAuthTokenExchangeRequest', { ...request, project_id: undefined }).valid).toBe(
            false,
        );
        expect(
            validateApiRequest('OAuthTokenExchangeRequest', { ...request, requested_token_type: 'refresh_token' })
                .valid,
        ).toBe(false);
        expect(validateApiRequest('OAuthTokenExchangeRequest', { ...request, actor_token: 'unsupported' }).valid).toBe(
            false,
        );
    });
    it('excludes refresh and ID tokens from the exchange response contract', () => {
        const response = {
            access_token: 'access',
            token_type: 'Bearer',
            expires_in: 300,
            issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        };
        expect(validateApiRequest('OAuthTokenExchangeResponse', response).valid).toBe(true);
        for (const extra of [{ refresh_token: 'refresh' }, { refresh_token_expires_in: 3600 }, { id_token: 'id' }]) {
            expect(validateApiRequest('OAuthTokenExchangeResponse', { ...response, ...extra }).valid).toBe(false);
        }
    });
    it('rejects excessive output lifetimes and symmetric signing algorithms', () => {
        const connection = {
            name: 'Customer',
            issuer: 'https://identity.example.com',
            external_id_claim: 'oid',
            allowed_audiences: ['backend'],
            allowed_algorithms: ['RS256'],
            subject_token_type: request.subject_token_type,
            allowed_project_ids: [request.project_id],
            allowed_scopes: ['content:read'],
            max_token_ttl_seconds: 300,
            enabled: true,
        };
        expect(validateApiRequest('OidcFederationConnectionPayload', connection).valid).toBe(true);
        expect(
            validateApiRequest('OidcFederationConnectionPayload', {
                ...connection,
                all_projects: true,
                allowed_project_ids: [],
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('OidcFederationConnectionPayload', { ...connection, all_projects: 'true' }).valid,
        ).toBe(false);
        const { allowed_scopes: _scopes, ...defaultPolicy } = connection;
        expect(validateApiRequest('OidcFederationConnectionPayload', defaultPolicy).valid).toBe(true);
        expect(validateApiRequest('OidcFederationConnectionPayload', { ...connection, allowed_scopes: [] }).valid).toBe(
            false,
        );
        for (const max_subject_token_age_seconds of [0, 29, 86401, 90.5]) {
            expect(
                validateApiRequest('OidcFederationConnectionPayload', { ...connection, max_subject_token_age_seconds })
                    .valid,
            ).toBe(false);
        }
        for (const external_id_claim of [undefined, '', '   ', 42]) {
            expect(
                validateApiRequest('OidcFederationConnectionPayload', { ...connection, external_id_claim }).valid,
            ).toBe(false);
        }
        expect(
            validateApiRequest('OidcFederationConnectionPayload', { ...connection, max_token_ttl_seconds: 3600 }).valid,
        ).toBe(false);
        expect(
            validateApiRequest('OidcFederationConnectionPayload', { ...connection, allowed_algorithms: ['HS256'] })
                .valid,
        ).toBe(false);
    });
});
