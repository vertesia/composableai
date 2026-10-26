import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerOidcFederationCommand } from './index.js';

// Keep the SDK real: only the external HTTP transport and credential input are fixtures.
vi.mock('../client.js', () => ({
    getClient: () => {
        throw new Error('Exchange must not load a logged-in client');
    },
}));
vi.mock('../utils/stdio.js', () => ({
    readFile: () => 'signed-idp-token\n',
    readStdin: async () => 'signed-idp-token\n',
}));
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('federation exchange with the real SDK', () => {
    it.each([undefined, 'content:read'])('posts a credential-free exchange with optional scope %s', async (scope) => {
        const requests: Request[] = [];
        const response = {
            access_token: 'scoped-access-token',
            token_type: 'Bearer',
            expires_in: 300,
            scope: 'content:read',
            issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (request: Request) => {
                requests.push(request);
                return Response.json(response);
            }),
        );
        const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const program = new Command().exitOverride();
        registerOidcFederationCommand(program);
        await program.parseAsync(
            [
                'oidc-federation',
                'exchange',
                '--sts-url',
                'https://sts.example.com',
                '--connection',
                '012345678901234567890124',
                '--project',
                '012345678901234567890123',
                '--resource',
                'https://api.example.com/',
                ...(scope ? ['--scope', scope] : []),
                '--subject-token-file',
                '-',
            ],
            { from: 'user' },
        );
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe('https://sts.example.com/oauth/token');
        expect(requests[0].method).toBe('POST');
        expect(requests[0].headers.has('Authorization')).toBe(false);
        expect(await requests[0].json()).toEqual({
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            subject_token: 'signed-idp-token',
            subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
            federation_connection_id: '012345678901234567890124',
            project_id: '012345678901234567890123',
            resource: 'https://api.example.com/',
            ...(scope ? { scope } : {}),
        });
        expect(JSON.parse(output.mock.calls[0][0])).toEqual(response);
    });
});
