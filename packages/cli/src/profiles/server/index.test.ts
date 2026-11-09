import type { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigResult } from './index.js';

const mocks = vi.hoisted(() => ({
    open: vi.fn<(url: string) => Promise<void>>(),
    peerOwnedByCurrentUser: vi.fn<(socket: Socket) => Promise<boolean>>(),
}));

vi.mock('open', () => ({ default: mocks.open }));
vi.mock('./server.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./server.js')>()),
    isPeerOwnedByCurrentUser: mocks.peerOwnedByCurrentUser,
}));
// The manual-entry prompt never resolves: these tests drive the HTTP callback only.
vi.mock('enquirer', () => ({ default: { prompt: () => new Promise(() => undefined) } }));

import { startConfigSession } from './index.js';

const result: ConfigResult = {
    profile: 'victim',
    account: 'account',
    project: 'project',
    studio_server_url: 'https://api.example.test',
    zeno_server_url: 'https://store.example.test',
    token: 'token',
};

interface Session {
    callback: ReturnType<typeof vi.fn<(result: ConfigResult | undefined) => void>>;
    redirectUri: URL;
    controller: AbortController;
}

let session: Session | undefined;

async function startSession(): Promise<Session> {
    const opened = new Promise<string>((resolve) => {
        mocks.open.mockImplementation(async (url: string) => {
            resolve(url);
        });
    });
    const callback = vi.fn<(result: ConfigResult | undefined) => void>();
    const controller = new AbortController();
    void startConfigSession('https://ui.example.test/cli', { profile: 'victim' }, callback, controller.signal);
    const url = new URL(await opened);
    const redirect = url.searchParams.get('redirect_uri');
    if (!redirect) {
        throw new Error('The browser URL carries no redirect_uri');
    }
    session = { callback, redirectUri: new URL(redirect), controller };
    return session;
}

function post(url: URL | string, body: string) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
}

beforeEach(() => {
    mocks.peerOwnedByCurrentUser.mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    session?.controller.abort();
    session = undefined;
    vi.restoreAllMocks();
});

describe('legacy CLI login callback', () => {
    it('listens on the IPv4 loopback interface only', async () => {
        const { redirectUri, callback } = await startSession();
        expect(redirectUri.hostname).toBe('127.0.0.1');

        // Not reachable on other interfaces (the IPv6 loopback stands in for any other address).
        await expect(
            post(`http://[::1]:${redirectUri.port}${redirectUri.pathname}${redirectUri.search}`, '{}'),
        ).rejects.toThrow();
        expect(callback).not.toHaveBeenCalled();
    });

    it('rejects a result that does not carry the per-login state', async () => {
        const { redirectUri, callback } = await startSession();
        const peerUrl = `http://127.0.0.1:${redirectUri.port}/`;

        const response = await post(peerUrl, JSON.stringify(result));

        expect(response.status).toBe(403);
        expect(callback).not.toHaveBeenCalled();
    });

    it('rejects a result carrying a guessed state', async () => {
        const { redirectUri, callback } = await startSession();
        const guessed = new URL(redirectUri);
        guessed.searchParams.set('state', 'A'.repeat(43));

        const response = await post(guessed, JSON.stringify(result));

        expect(response.status).toBe(403);
        expect(callback).not.toHaveBeenCalled();
    });

    it('accepts the result posted to the redirect URI it handed the browser, once', async () => {
        const { redirectUri, callback } = await startSession();

        const response = await post(redirectUri, JSON.stringify(result));

        expect(response.status).toBe(200);
        await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
        expect(callback).toHaveBeenCalledWith(result);
    });

    it('rejects the exact redirect URI when another local account opened the connection', async () => {
        // The browser launcher receives the full redirect URI in its argv (xdg-open, then the browser itself on
        // Linux), so another local account can read the state from procfs. Knowing it must not be enough.
        const { redirectUri, callback } = await startSession();
        const launched = new URL(mocks.open.mock.calls[0][0]);
        expect(launched.searchParams.get('redirect_uri')).toBe(redirectUri.toString());
        mocks.peerOwnedByCurrentUser.mockResolvedValue(false);

        const response = await post(redirectUri, JSON.stringify(result));

        expect(response.status).toBe(403);
        expect(callback).not.toHaveBeenCalled();
        // The verdict was reached for the connection that carried the request.
        expect(mocks.peerOwnedByCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('rejects an oversized body before buffering it', async () => {
        const { redirectUri, callback } = await startSession();
        const body = JSON.stringify({ ...result, padding: 'x'.repeat(2 * 1024 * 1024) });

        const status = await post(redirectUri, body).then(
            (response) => response.status,
            // The server may reset the connection once it has answered 413.
            () => 413,
        );

        expect(status).toBe(413);
        expect(callback).not.toHaveBeenCalled();
    });
});
