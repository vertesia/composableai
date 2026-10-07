import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    canUseOAuthProfile,
    discoverCliConfiguration,
    getOAuthClientIdFromMetadata,
    getOAuthResource,
} from './oauth.js';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('CLI OAuth profile eligibility', () => {
    it.each([
        'https://api.us1.vertesia.io',
        'https://api-preview.dev1.vertesia.io',
        'https://studio-server-dev-feature.api.dev1.vertesia.io',
        'https://custom.example.com',
    ])('uses OAuth for a configured HTTPS API: %s', (studio_server_url) => {
        expect(canUseOAuthProfile({ studio_server_url })).toBe(true);
    });
    it.each(['http://localhost:8091', 'https://localhost:8091', 'http://127.0.0.1:8091'])(
        'uses an explicitly configured STS for local profiles without a hidden dev flag: %s',
        (studio_server_url) => {
            vi.stubEnv('IS_LOCAL_DEV', '');
            expect(canUseOAuthProfile({ studio_server_url, oauth_server_url: 'https://sts.dev1.vertesia.io' })).toBe(
                true,
            );
        },
    );
    it('keeps bootstrap for unknown custom service URLs and rejects remote HTTP APIs', () => {
        expect(canUseOAuthProfile({})).toBe(false);
        expect(
            canUseOAuthProfile({
                studio_server_url: 'http://remote.example.com',
                oauth_server_url: 'https://sts.example.com',
            }),
        ).toBe(false);
    });
    it('uses canonical STS metadata for the device client and resource', () => {
        const metadata = {
            issuer: 'https://branch-sts.example.com',
            token_endpoint: 'https://branch-sts.example.com/oauth/token',
        };
        expect(getOAuthResource(metadata)).toBe('https://branch-sts.example.com/');
        expect(getOAuthClientIdFromMetadata(metadata)).toBe(
            'https://branch-sts.example.com/.well-known/oauth-client/vertesia-cli',
        );
    });
});

describe('public CLI discovery', () => {
    it('discovers a custom branch without sending a credential', async () => {
        const config = {
            studio_server_url: 'https://studio.example.com',
            zeno_server_url: 'https://zeno.example.com',
            oauth_server_url: 'https://branch-sts.example.com',
        };
        const fetcher = vi.fn().mockResolvedValue(Response.json(config));
        vi.stubGlobal('fetch', fetcher);
        expect(await discoverCliConfiguration('https://ui.example.com/cli')).toEqual(config);
        expect(fetcher.mock.calls[0][0].pathname).toBe('/.well-known/vertesia-cli');
        expect(fetcher.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' });
    });
    it.each([new Response('', { status: 404 }), new Response('<html/>', { headers: { 'content-type': 'text/html' } })])(
        'keeps legacy bootstrap for older deployments',
        async (response) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
            expect(await discoverCliConfiguration('https://ui.example.com/cli')).toBeUndefined();
        },
    );
    it('fails closed for invalid discovery or transport errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(Response.json({ studio_server_url: 'http://remote.example.com' })),
        );
        await expect(discoverCliConfiguration('https://ui.example.com')).rejects.toThrow('Invalid CLI endpoint');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TLS failed')));
        await expect(discoverCliConfiguration('https://ui.example.com')).rejects.toThrow('TLS failed');
    });
});
