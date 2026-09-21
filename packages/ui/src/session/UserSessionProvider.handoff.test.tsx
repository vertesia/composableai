import { cleanup, render, waitFor } from '@testing-library/react';
import { type AuthTokenPayload, PrincipalType } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { generateAuthState } from './auth/authState';
import { getComposableToken } from './auth/composable';
import { usesAppOAuth } from './auth/oauth';
import { useUserSession } from './UserSession';
import { UserSessionProvider } from './UserSessionProvider';

// Only the credential exchange boundary is stubbed. Provider selection, nonce consumption,
// session cloning, and the SDK authorization callback run together.
vi.mock('./auth/composable', async (original) => ({
    ...(await original<typeof import('./auth/composable')>()),
    getComposableToken: vi.fn(),
}));
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
    localStorage.clear();
});

it.each(
    ['/oauth/device?user_code=ABCD-EFGH', '/oauth/authorize/request-id', '/cli'].flatMap((path) =>
        ['token', 'oauth'].map((method) => ({ path, method })),
    ),
)('keeps the $method session API callback on $path', async ({ path, method }) => {
    const issuer = 'https://sts.dev1.vertesia.io';
    const clientId = 'https://api.dev1.vertesia.io/.well-known/oauth-client/vertesia-studio';
    const claims: AuthTokenPayload = {
        sub: 'user',
        user_id: 'user',
        name: 'Test User',
        type: method === 'oauth' ? PrincipalType.OAuthAccess : PrincipalType.User,
        iss: issuer,
        apps: [],
        accounts: [],
        account_roles: [],
        aud: issuer,
        account: { id: 'a', name: 'Account' },
        project: { id: 'p', name: 'Project', account: 'a' },
        exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = `e30.${btoa(JSON.stringify(claims))}.signature`;
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: 'https://api.dev1.vertesia.io', zeno: 'https://api.dev1.vertesia.io', sts: issuer },
        oauth: {
            clientId,
            redirectUri: `${window.location.origin}/oauth/callback`,
        },
    });
    const url = new URL(path, window.location.origin);
    url.searchParams.set('a', 'a');
    url.searchParams.set('p', 'p');
    if (method === 'token') {
        const state = generateAuthState();
        url.hash = `token=${token}&state=${state}`;
        vi.mocked(getComposableToken).mockResolvedValue({ rawToken: token, token: claims, error: false });
    } else {
        // Seed only synthetic credentials and public fixture metadata, never runtime auth configuration.
        sessionStorage.setItem(
            'vertesia.oauth.access',
            JSON.stringify({
                token,
                issuer,
                clientId,
            }),
        );
        vi.mocked(getComposableToken).mockRejectedValue(new Error('OAuth must not use the legacy exchange'));
    }
    window.history.replaceState(null, '', url.toString());
    const received = vi.fn();
    const failed = vi.fn();
    function Probe() {
        const session = useUserSession();
        useEffect(() => {
            if (session.user) void session.clone().authCallback.then(received).catch(failed);
        }, [session]);
        return <span>{session.user?.name}</span>;
    }
    const view = render(
        <UserSessionProvider loadOnboardingStatus={false}>
            <Probe />
        </UserSessionProvider>,
    );
    await view.findByText('Test User');
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(sessionStorage.getItem('auth_state')).toBeNull();
    expect(usesAppOAuth()).toBe(true);
    await waitFor(() => expect(received).toHaveBeenCalledWith(`Bearer ${token}`));
    expect(failed).not.toHaveBeenCalled();
    if (method === 'oauth') expect(getComposableToken).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('vertesia.oauth.transaction')).toBeNull();
});
