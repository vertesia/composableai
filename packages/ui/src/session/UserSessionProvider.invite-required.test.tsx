import { cleanup, render, waitFor } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { generateAuthState } from './auth/authState';
import { InviteRequiredError } from './auth/composable';
import { useUserSession } from './UserSession';
import { UserSessionProvider } from './UserSessionProvider';

const mocks = vi.hoisted(() => ({ redirect: vi.fn(), exchange: vi.fn() }));
vi.mock('./auth/domainRouting', async (original) => ({
    ...(await original<typeof import('./auth/domainRouting')>()),
    shouldRedirectToCentralAuth: () => true,
    redirectToCentralAuth: mocks.redirect,
}));
vi.mock('./auth/composable', async (original) => ({
    ...(await original<typeof import('./auth/composable')>()),
    getComposableToken: mocks.exchange,
}));
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
});

// Central auth hands back the identity Studio just refused; sending the user there again would loop.
it('shows an invite-required refusal after central auth instead of redirecting again', async () => {
    window.history.replaceState(null, '', `/#token=id-token&state=${generateAuthState()}`);
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: 'https://api.example', zeno: 'https://api.example', sts: 'https://sts.example' },
    });
    const refusal = new InviteRequiredError('Customer-domain user requires an invite to join', 'sam@example.gov');
    mocks.exchange.mockRejectedValue(refusal);
    const seen = vi.fn();
    function Probe() {
        const session = useUserSession();
        useEffect(() => {
            if (session.authError) seen(session.authError);
        }, [session]);
        return null;
    }
    render(
        <UserSessionProvider>
            <Probe />
        </UserSessionProvider>,
    );

    await waitFor(() => expect(seen).toHaveBeenCalledWith(refusal));
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
});
