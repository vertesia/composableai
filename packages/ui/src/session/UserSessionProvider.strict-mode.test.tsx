import { cleanup, render, waitFor } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { redirectToCentralAuth } from './auth/domainRouting';
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
