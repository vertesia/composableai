import { cleanup, render, waitFor } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { redirectToCentralAuth } from './auth/domainRouting';
import { useUserSession } from './UserSession';
import { UserSessionProvider } from './UserSessionProvider';

vi.mock('./auth/useAuthState', () => ({ useAuthState: () => ({}) }));
vi.mock('./auth/domainRouting', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./auth/domainRouting')>()),
    shouldRedirectToCentralAuth: () => true,
    redirectToCentralAuth: vi.fn(),
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete window.__VERTESIA_RUNTIME_CONFIG__;
});

it('continues authentication after StrictMode cancels the first host-token attempt', async () => {
    const authTokenProvider = vi.fn(async () => undefined);
    Env.init({
        name: 'test',
        version: '1',
        type: 'development',
        isLocalDev: true,
        isDocker: false,
        endpoints: {
            studio: 'https://api.example.com',
            zeno: 'https://api.example.com',
            sts: 'https://sts.example.com',
        },
        authTokenProvider,
    });
    render(
        <StrictMode>
            <UserSessionProvider>
                <span>App</span>
            </UserSessionProvider>
        </StrictMode>,
    );
    await waitFor(() => expect(redirectToCentralAuth).toHaveBeenCalledTimes(1));
    expect(authTokenProvider).toHaveBeenCalledTimes(2);
});

it('bootstraps a gateway session from claims without starting broker authentication', async () => {
    window.__VERTESIA_RUNTIME_CONFIG__ = { authMode: 'central', gatewaySession: true };
    const claims = { sub: 'gateway-user', name: 'Gateway User', account: { id: 'a' }, project: { id: 'p' } };
    const fetch = vi.fn(async (_request: Request) => Response.json(claims));
    vi.stubGlobal('fetch', fetch);
    Env.init({
        name: 'gateway',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: {
            studio: 'https://api.example.com',
            zeno: 'https://api.example.com',
            sts: 'https://sts.example.com',
        },
    });
    function Probe() {
        const session = useUserSession();
        return <span>{session.user?.name}</span>;
    }
    const view = render(
        <StrictMode>
            <UserSessionProvider>
                <Probe />
            </UserSessionProvider>
        </StrictMode>,
    );
    await view.findByText('Gateway User');
    expect(redirectToCentralAuth).not.toHaveBeenCalled();
    expect(fetch.mock.calls.every(([request]) => new URL(request.url).pathname === '/__appgen/session')).toBe(true);
});
