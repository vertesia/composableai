import type { CreateOAuthAuthorizationRequestPayload } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

const payload: CreateOAuthAuthorizationRequestPayload = {
    response_type: 'code',
    client_id: 'client-1',
    redirect_uri: 'http://127.0.0.1/callback',
    resource: 'https://mcp-dev-main.api.dev1.vertesia.io/mcp',
    code_challenge: 'A'.repeat(43),
    code_challenge_method: 'S256',
};

function createClient(requests: Request[]) {
    return new VertesiaClient({
        serverUrl: 'https://studio.example.com',
        storeUrl: 'https://zeno.example.com',
        tokenServerUrl: 'https://sts.dev1.vertesia.io',
        fetch: vi.fn(async () =>
            Response.json({
                request_id: 'vor_1',
                client_id: 'client-1',
                client_name: 'Codex',
                redirect_uri: payload.redirect_uri,
                redirect_origin: 'http://127.0.0.1',
                requested_scopes: [],
                project_binding_mode: 'user_select',
                status: 'pending',
                created_at: '2026-08-10T00:00:00.000Z',
                expires_at: '2026-08-10T00:10:00.000Z',
            }),
        ),
        onRequest: (request) => requests.push(request),
    });
}

describe('OAuthServerApi.createAuthorizationRequest', () => {
    it('posts the initial request to the path-based tenant issuer', async () => {
        const requests: Request[] = [];
        const client = createClient(requests);

        await client.oauthServer.createAuthorizationRequest(payload, '/env/dev1/dev-main');

        expect(requests[0]?.url).toBe('https://sts.dev1.vertesia.io/env/dev1/dev-main/requests');
    });

    it('rejects an untrusted authorization-server path before making a request', async () => {
        const requests: Request[] = [];
        const client = createClient(requests);

        await expect(
            client.oauthServer.createAuthorizationRequest(payload, 'https://attacker.example.com/oauth'),
        ).rejects.toThrow('Invalid OAuth authorization server path');
        expect(requests).toHaveLength(0);
    });
});

describe('OAuthServerApi.exchangeToken', () => {
    it('sends only the assertion and policy selectors without client credentials', async () => {
        const requests: Request[] = [];
        const response = {
            access_token: 'short-lived-token',
            token_type: 'Bearer',
            issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            expires_in: 300,
            scope: 'content:read',
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            tokenServerUrl: 'https://sts.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        const request = {
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' as const,
            subject_token: 'signed-idp-assertion',
            subject_token_type: 'urn:ietf:params:oauth:token-type:jwt' as const,
            federation_connection_id: '012345678901234567890123',
            project_id: '012345678901234567890124',
            resource: 'https://api.example.com/',
            scope: 'content:read',
        };
        expect(await client.oauthServer.exchangeToken(request)).toEqual(response);
        expect(requests[0]?.url).toBe('https://sts.example.com/oauth/token');
        expect(await requests[0]?.json()).toEqual(request);
        expect(requests[0]?.headers.has('Authorization')).toBe(false);
    });
});

describe('authenticated federation exchange', () => {
    const payload = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange' as const,
        subject_token: 'user-assertion',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt' as const,
        federation_connection_id: '012345678901234567890123',
        project_id: '012345678901234567890124',
        resource: 'https://api.example/',
    };
    it('sends HTTP Basic credentials in the header and keeps them out of the body', async () => {
        const requests: Request[] = [];
        const client = createClient(requests);
        await client.oauthServer.exchangeToken(payload, { client_id: 'vts_client', client_secret: 'a+b:c' });
        expect(requests[0].headers.get('authorization')).toBe(`Basic ${btoa('vts_client:a%2Bb%3Ac')}`);
        expect(await requests[0].clone().json()).toEqual(payload);
    });
    it('passes signed assertions and rejects mixed authentication before a request', async () => {
        const requests: Request[] = [];
        const client = createClient(requests);
        const signed = {
            ...payload,
            client_id: 'vts_client',
            client_assertion: 'signed',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' as const,
        };
        await client.oauthServer.exchangeToken(signed);
        expect(await requests[0].clone().json()).toEqual(signed);
        expect(() =>
            client.oauthServer.exchangeToken(signed, { client_id: 'vts_client', client_secret: 'secret' }),
        ).toThrow('exactly one');
        expect(requests).toHaveLength(1);
    });
});
