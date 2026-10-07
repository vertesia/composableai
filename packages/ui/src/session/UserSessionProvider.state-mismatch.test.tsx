import { cleanup, render, waitFor } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { afterEach, expect, it, vi } from 'vitest';
import { UserSessionProvider } from './UserSessionProvider';

const mocks = vi.hoisted(() => ({ clear: vi.fn(), redirect: vi.fn(), exchange: vi.fn() }));
vi.mock('./auth/useAuthState', () => ({
    useAuthState: () => ({ verifyState: () => 'mismatch', clearState: mocks.clear }),
}));
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
});
it('clears a mismatched fragment and returns without exchanging credentials', async () => {
    window.history.replaceState(null, '', '/#token=untrusted&state=wrong');
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: 'https://api.example', zeno: 'https://api.example', sts: 'https://sts.example' },
    });
    render(
        <UserSessionProvider>
            <span>App</span>
        </UserSessionProvider>,
    );
    await waitFor(() => expect(mocks.redirect).toHaveBeenCalledOnce());
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe('');
    expect(mocks.exchange).not.toHaveBeenCalled();
});
