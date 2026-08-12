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
