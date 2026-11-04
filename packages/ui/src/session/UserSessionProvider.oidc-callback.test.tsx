import { cleanup, render } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useUserSession } from './UserSession';
import { UserSessionProvider } from './UserSessionProvider';

vi.mock('./auth/useAuthState', () => ({ useAuthState: () => ({}) }));

const issuer = 'https://login.example.gov/tenant/v2.0';
const clientId = 'apps-client';
const tokenEndpoint = `${issuer}/token`;

function idToken(nonce: string): string {
    const claims = { iss: issuer, aud: clientId, sub: 'user', nonce, exp: Date.now() / 1000 + 3600 };
    return `e30.${btoa(JSON.stringify(claims))}.signature`;
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
});

// Strict Mode runs the provider's effect twice. The first run leaves the callback URL before the code
// exchange settles, so the second run must wait for that exchange rather than sign the user out.
it('keeps a provider callback signing in when Strict Mode replays the effect', async () => {
    sessionStorage.setItem(
        'vertesia.oidc.transaction',
        JSON.stringify({
            state: 'state-1',
            nonce: 'nonce-1',
            verifier: 'verifier',
            issuer,
            clientId,
            created: Date.now(),
            returnTo: `${window.location.origin}/app`,
        }),
    );
    window.history.replaceState(null, '', '/oidc/callback?code=one-time-code&state=state-1');
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
        release = resolve;
    });
    const fetch = vi.fn(async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === tokenEndpoint) {
            await released;
            return Response.json({ id_token: idToken('nonce-1') });
        }
        if (url === `${issuer}/.well-known/openid-configuration`) {
            return Response.json({
                issuer,
                authorization_endpoint: `${issuer}/authorize`,
                token_endpoint: tokenEndpoint,
            });
        }
        throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    Env.init({
        name: 'app',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: {
            studio: 'https://api.example.gov',
            zeno: 'https://api.example.gov',
            sts: 'https://sts.example.gov',
        },
        oidc: { issuer, clientId },
    });
    const states: string[] = [];
    function Probe() {
        const session = useUserSession();
        states.push(session.isLoading ? 'loading' : 'signed-out');
        return null;
    }

    render(
        <StrictMode>
            <UserSessionProvider>
                <Probe />
            </UserSessionProvider>
        </StrictMode>,
    );
    await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url) === tokenEndpoint)).toBe(true));
    release();
    await vi.waitFor(() => expect(sessionStorage.getItem('vertesia.oidc.id_token')).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetch.mock.calls.filter(([url]) => String(url) === tokenEndpoint)).toHaveLength(1);
    expect(window.location.pathname).toBe('/app');
    expect(states).not.toContain('signed-out');
});
