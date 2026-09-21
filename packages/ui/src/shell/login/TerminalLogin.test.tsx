import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Env } from '@vertesia/ui/env';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TerminalLogin } from './TerminalLogin';

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), token: vi.fn() }));
const account = { id: 'account-a', name: 'Account A' };
const project = { id: 'project-a', name: 'Project A', account: account.id };
const session = {
    user: { sub: 'user-a' },
    account,
    project,
    accounts: [account],
    client: { projects: { list: async () => [project] } },
    get rawAuthToken() {
        return mocks.token();
    },
};
vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => session,
    fetchComposableTokenFromVertesiaToken: mocks.exchange,
}));
vi.mock('@vertesia/ui/router', () => ({ useLocation: () => window.location }));
vi.mock('@vertesia/ui/i18n', () => ({ useUITranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@vertesia/ui/core', async (original) => ({
    ...(await original<typeof import('@vertesia/ui/core')>()),
    useToast: () => vi.fn(),
}));

beforeEach(() => {
    Env.init({
        version: 'test',
        isLocalDev: true,
        isDocker: false,
        type: 'development',
        name: 'test',
        endpoints: {
            studio: 'https://studio.example.test',
            zeno: 'https://zeno.example.test',
            sts: 'https://branch-sts.example.test',
        },
    });
    history.replaceState({}, '', '/cli?redirect_uri=http%3A%2F%2Flocalhost%3A49369&code=1716&profile=custom');
    mocks.exchange.mockReset().mockResolvedValue('cli-token');
    mocks.token.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it.each(['oauth-session', 'firebase-session', 'central-session'])(
    'exchanges the active %s and returns the deployment STS to custom CLI profiles',
    async (token) => {
        mocks.token.mockResolvedValue(token);
        render(<TerminalLogin />);
        fireEvent.click(await screen.findByRole('button', { name: 'login.terminal.authorizeClient' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        expect(mocks.exchange).toHaveBeenCalledWith(token, account.id, project.id, 86400);
        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(JSON.parse(init?.body as string)).toMatchObject({
            token: 'cli-token',
            profile: 'custom',
            account: account.id,
            project: project.id,
            oauth_server_url: 'https://branch-sts.example.test',
        });
    },
);

it('does not send a credential to the CLI when the exchange fails', async () => {
    mocks.token.mockResolvedValue('oauth-session');
    mocks.exchange.mockRejectedValue(new Error('Exchange denied'));
    render(<TerminalLogin />);
    fireEvent.click(await screen.findByRole('button', { name: 'login.terminal.authorizeClient' }));
    await waitFor(() => expect(mocks.exchange).toHaveBeenCalledOnce());
    expect(fetch).not.toHaveBeenCalled();
});
