// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gatewayFetch, gatewayLoginUrl, loadGatewaySession, logoutGatewaySession, usesGatewaySession } from './gateway';

const replace = vi.fn();
beforeEach(() => {
    const browser = {
        location: {
            href: 'https://app.example/reports?a=account&p=project#chart',
            origin: 'https://app.example',
            replace,
        },
        __VERTESIA_RUNTIME_CONFIG__: { authMode: 'central', gatewaySession: true },
    };
    vi.stubGlobal('window', Object.assign(browser, { parent: browser }));
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

it('activates only for a standalone app explicitly served with a gateway session', () => {
    expect(usesGatewaySession()).toBe(true);
    window.__VERTESIA_RUNTIME_CONFIG__ = { authMode: 'central' };
    expect(usesGatewaySession()).toBe(false);
    window.__VERTESIA_RUNTIME_CONFIG__ = { authMode: 'central', gatewaySession: true };
    Object.defineProperty(window, 'parent', { value: {} });
    expect(usesGatewaySession()).toBe(false);
});
it('preserves account, project and deep link through the existing OAuth login route', () => {
    const url = new URL(gatewayLoginUrl());
    expect(url.origin + url.pathname).toBe('https://app.example/__appgen/auth/login');
    expect(url.searchParams.get('target')).toBe('/reports?a=account&p=project#chart');
});
it('uses same-origin cookies and never forwards browser bearer credentials', async () => {
    const fetch = vi.fn(async (_request: Request) => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await gatewayFetch('https://app.example/__appgen/session/studio/api/v1/apps', {
        headers: { Authorization: 'Bearer browser-token' },
    });
    const request = fetch.mock.calls[0]?.[0] as Request | undefined;
    expect(request?.headers.get('authorization')).toBeNull();
    expect(request?.headers.get('x-vertesia-app-session')).toBe('1');
    expect(request?.credentials).toBe('same-origin');
    await expect(gatewayFetch('https://other.example/api')).rejects.toThrow('application origin');
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('redirects an expired session into CIMD login without invoking the direct broker', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(
            async () =>
                new Response('{}', {
                    status: 401,
                    headers: { 'x-vertesia-session-required': '1' },
                }),
        ),
    );
    void loadGatewaySession();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(gatewayLoginUrl()));
});
it('surfaces outages and ordinary upstream 401s instead of creating login loops', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await expect(loadGatewaySession()).rejects.toThrow('503');
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 401 })),
    );
    expect((await gatewayFetch('https://app.example/api')).status).toBe(401);
    expect(replace).not.toHaveBeenCalled();
});
it('loads claims without a JWT and signs out through a protected POST', async () => {
    const claims = { sub: 'user', account: { id: 'account' }, project: { id: 'project' } };
    const fetch = vi.fn(async (_request: Request) => new Response(JSON.stringify(claims)));
    vi.stubGlobal('fetch', fetch);
    expect(await loadGatewaySession()).toEqual(claims);
    await logoutGatewaySession();
    expect(fetch.mock.calls.at(-1)?.[0].method).toBe('POST');
});
