import { cleanup, render, waitFor } from '@testing-library/react';
import { type AuthTokenPayload, PrincipalType } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { onAuthStateChanged } from 'firebase/auth';
import { afterEach, expect, it, vi } from 'vitest';
import {
    IFRAME_APP_HOST_ORIGIN_PARAM,
    IFRAME_AUTH_RESPONSE,
    requestIframeHostAuthToken,
} from '../shell/apps/iframe-auth';
import { getComposableToken } from './auth/composable';
import { redirectToCentralAuth, shouldRedirectToCentralAuth } from './auth/domainRouting';
import { getFirebaseAuth } from './auth/firebase';
import { useUserSession } from './UserSession';
import { UserSessionProvider } from './UserSessionProvider';

vi.mock('./auth/composable', async (original) => ({
    ...(await original<typeof import('./auth/composable')>()),
    getComposableToken: vi.fn(),
}));
vi.mock('./auth/domainRouting', async (original) => ({
    ...(await original<typeof import('./auth/domainRouting')>()),
    redirectToCentralAuth: vi.fn(),
    shouldRedirectToCentralAuth: vi.fn(() => true),
}));
vi.mock('./auth/firebase', () => ({ getFirebaseAuth: vi.fn() }));
vi.mock('firebase/auth', async (original) => ({
    ...(await original<typeof import('firebase/auth')>()),
    onAuthStateChanged: vi.fn(() => vi.fn()),
}));

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
const hostOrigin = 'https://cloud.vertesia.io';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    else Reflect.deleteProperty(window, 'parent');
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
    localStorage.clear();
});

function init(options: { allowLegacyIframeAuth?: boolean; isLocalDev?: boolean; provider?: boolean } = {}) {
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isDocker: false,
        isLocalDev: options.isLocalDev ?? false,
        allowLegacyIframeAuth: options.allowLegacyIframeAuth,
        endpoints: {
            studio: 'https://api.dev1.vertesia.io',
            zeno: 'https://api.dev1.vertesia.io',
            sts: 'https://sts.dev1.vertesia.io',
        },
        authTokenProvider: options.provider === false ? undefined : () => requestIframeHostAuthToken(20),
    });
    window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=${encodeURIComponent(hostOrigin)}`);
}

function embed(response?: { token?: string; expiresAt?: number }) {
    const parentWindow = {
        postMessage: vi.fn((request: { requestId: string }) => {
            if (!response) return;
            queueMicrotask(() =>
                window.dispatchEvent(
                    new MessageEvent('message', {
                        source: parentWindow as unknown as Window,
                        origin: hostOrigin,
                        data: { type: IFRAME_AUTH_RESPONSE, requestId: request.requestId, ...response },
                    }),
                ),
            );
        }),
    };
    Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
    return parentWindow;
}

function Probe() {
    const session = useUserSession();
    return <span>{session.isLoading ? 'loading' : (session.authError?.message ?? session.user?.name ?? 'ready')}</span>;
}

const hostFailures = [
    { name: 'denied', response: {} },
    { name: 'expired', response: { token: 'expired', expiresAt: 0 } },
    { name: 'NaN expiry', response: { token: 'invalid', expiresAt: Number.NaN } },
    { name: 'infinite expiry', response: { token: 'invalid', expiresAt: Number.POSITIVE_INFINITY } },
    { name: 'timeout', response: undefined },
];

it.each(hostFailures)('does not fall back after a $name host response', async ({ response }) => {
    init();
    const parentWindow = embed(response);
    const view = render(
        <UserSessionProvider>
            <Probe />
        </UserSessionProvider>,
    );
    await view.findByText('Embedded authentication requires a valid token from the host.');
    expect(parentWindow.postMessage).toHaveBeenCalled();
    expect(getComposableToken).not.toHaveBeenCalled();
    expect(redirectToCentralAuth).not.toHaveBeenCalled();
    expect(getFirebaseAuth).not.toHaveBeenCalled();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
});

it.each([undefined, false])(
    'fails closed locally without a provider (allowLegacyIframeAuth=%s)',
    async (allowLegacyIframeAuth) => {
        init({ isLocalDev: true, allowLegacyIframeAuth, provider: false });
        embed();
        const view = render(
            <UserSessionProvider>
                <Probe />
            </UserSessionProvider>,
        );
        await view.findByText('Embedded authentication requires a valid token from the host.');
        expect(redirectToCentralAuth).not.toHaveBeenCalled();
        expect(getFirebaseAuth).not.toHaveBeenCalled();
    },
);

it.each([false, true])('preserves explicit legacy fallback (central=%s)', async (central) => {
    init({ allowLegacyIframeAuth: true });
    embed({});
    vi.mocked(shouldRedirectToCentralAuth).mockReturnValue(central);
    render(
        <UserSessionProvider>
            <Probe />
        </UserSessionProvider>,
    );
    await waitFor(() => expect(central ? redirectToCentralAuth : onAuthStateChanged).toHaveBeenCalled());
});

it('preserves standalone sign-in when no host is present', async () => {
    init();
    vi.mocked(shouldRedirectToCentralAuth).mockReturnValue(true);
    render(
        <UserSessionProvider>
            <Probe />
        </UserSessionProvider>,
    );
    await waitFor(() => expect(redirectToCentralAuth).toHaveBeenCalled());
});

it('uses a valid scoped host token without starting another auth flow', async () => {
    init();
    const claims: AuthTokenPayload = {
        sub: 'user',
        user_id: 'user',
        name: 'Embedded user',
        type: PrincipalType.OAuthAccess,
        iss: 'https://sts.dev1.vertesia.io',
        aud: 'https://sts.dev1.vertesia.io',
        apps: [],
        accounts: [],
        account_roles: [],
        account: { id: 'a', name: 'Account' },
        project: { id: 'p', name: 'Project', account: 'a' },
        exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = `e30.${btoa(JSON.stringify(claims))}.signature`;
    embed({ token, expiresAt: Date.now() + 60_000 });
    vi.mocked(getComposableToken).mockResolvedValue({ rawToken: token, token: claims, error: false });
    const view = render(
        <UserSessionProvider loadOnboardingStatus={false}>
            <Probe />
        </UserSessionProvider>,
    );
    await view.findByText('Embedded user');
    expect(getComposableToken).toHaveBeenCalledWith(undefined, undefined, token, false, true);
    expect(redirectToCentralAuth).not.toHaveBeenCalled();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
});
