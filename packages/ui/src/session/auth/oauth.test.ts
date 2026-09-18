// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const origin = 'https://standalone.vercel.app';
const issuer = 'https://sts.dev1.vertesia.io';
const clientId = `${origin}/.well-known/oauth-client/vertesia-app`;
const storage = new Map<string, string>();
const replace = vi.fn();
let browser: {
    location: { href: string; origin: string; replace: typeof replace };
    parent?: unknown;
    history: { state: null; replaceState: ReturnType<typeof vi.fn> };
};
let requests: { url: string; init?: RequestInit }[];
function jwt(): string {
    return `e30.${btoa(
        JSON.stringify({
            iss: issuer,
            client_id: clientId,
            exp: Date.now() / 1000 + 3600,
            sub: 'user',
            account: { id: 'a' },
            project: { id: 'p' },
        }),
    )}.signature`;
}
async function setup() {
    vi.resetModules();
    const { Env } = await import('../../env');
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: 'https://api.dev1.vertesia.io', zeno: 'https://api.dev1.vertesia.io', sts: issuer },
        oauth: { clientId, redirectUri: `${origin}/app` },
    });
    return import('./oauth');
}
beforeEach(() => {
    storage.clear();
    requests = [];
    browser = {
        location: { href: `${origin}/app/report?a=a&p=p#chart`, origin, replace },
        history: {
            state: null,
            replaceState: vi.fn((_state, _title, target: URL) => {
                browser.location.href = target.toString();
            }),
        },
    };
    browser.parent = browser;
    vi.stubGlobal('window', browser);
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL, init?: RequestInit) => {
            const url = String(input);
            requests.push({ url, init });
            if (url.endsWith('/.well-known/oauth-authorization-server'))
                return Response.json({
                    issuer,
                    authorization_endpoint: 'https://preview.cloud.dev1.vertesia.io/oauth/authorize',
                    token_endpoint: `${issuer}/oauth/token`,
                });
            if (url === clientId)
                return Response.json({
                    redirect_uris: [`${origin}/app`],
                    scope: 'openid profile content:read offline_access',
                });
            if (url === `${issuer}/oauth/token`) return Response.json({ access_token: jwt(), token_type: 'Bearer' });
            throw new Error(`Unexpected request: ${url}`);
        }),
    );
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

it('uses CIMD and PKCE, exchanges the callback once and restores the app deep link', async () => {
    const oauth = await setup();
    expect(oauth.usesAppOAuth()).toBe(true);
    void oauth.getAppOAuthToken();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    const authorize = new URL(replace.mock.calls[0][0]);
    expect(authorize.searchParams.get('client_id')).toBe(clientId);
    expect(authorize.searchParams.get('resource')).toBe(`${issuer}/`);
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${origin}/app`);
    expect(authorize.searchParams.get('scope')).toBe('openid profile content:read');
    expect(authorize.searchParams.get('project_id')).toBe('p');
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    const txn = JSON.parse(storage.get('vertesia.oauth.transaction') ?? '{}');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txn.verifier));
    expect(authorize.searchParams.get('code_challenge')).toBe(Buffer.from(digest).toString('base64url'));
    browser.location.href = `${origin}/app?code=one-time-code&state=${authorize.searchParams.get('state')}`;
    const callback = await setup();
    const token = await callback.getAppOAuthToken();
    expect(token).toBeTruthy();
    const exchange = requests.find((request) => request.url.endsWith('/oauth/token'));
    if (!exchange) throw new Error('Expected a code exchange');
    const body = exchange.init?.body as URLSearchParams;
    expect(body.get('code_verifier')).toBe(txn.verifier);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('resource')).toBe(authorize.searchParams.get('resource'));
    expect(body.has('client_secret')).toBe(false);
    expect(storage.has('vertesia.oauth.transaction')).toBe(false);
    expect(browser.location.href).toBe(`${origin}/app/report?a=a&p=p#chart`);
    expect(await callback.getAppOAuthToken()).toBe(token);
    expect(requests.filter((request) => request.url.endsWith('/oauth/token'))).toHaveLength(1);
});
it('rejects a forged callback before contacting the token endpoint', async () => {
    browser.location.href = `${origin}/app?code=forged&state=wrong`;
    const oauth = await setup();
    await expect(oauth.getAppOAuthToken()).rejects.toThrow('Invalid or expired');
    expect(requests).toHaveLength(0);
});
it('rejects discovery for a different issuer', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ issuer: 'https://wrong.test' })),
    );
    const oauth = await setup();
    await expect(oauth.getAppOAuthToken()).rejects.toThrow('issuer mismatch');
    expect(replace).not.toHaveBeenCalled();
});
it('does not override Firebase, embedded apps, gateway sessions, or unconfigured local apps', async () => {
    const oauth = await setup();
    const win = window as unknown as Record<string, unknown>;
    win.AUTH_MODE = 'firebase';
    expect(oauth.usesAppOAuth()).toBe(false);
    win.AUTH_MODE = 'central';
    win.parent = {};
    expect(oauth.usesAppOAuth()).toBe(false);
    win.parent = window;
    win.__VERTESIA_RUNTIME_CONFIG__ = { authMode: 'central', gatewaySession: true };
    expect(oauth.usesAppOAuth()).toBe(false);
    win.__VERTESIA_RUNTIME_CONFIG__ = undefined;
    const { Env } = await import('../../env');
    Env.init({
        name: 'local',
        version: '1',
        type: 'development',
        isLocalDev: true,
        isDocker: false,
        endpoints: { studio: issuer, zeno: issuer, sts: issuer },
    });
    expect(oauth.usesAppOAuth()).toBe(false);
});

it('supports a registered client ID without fetching a CIMD', async () => {
    const oauth = await setup();
    const { Env } = await import('../../env');
    Env.init({
        name: 'registered',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: issuer, zeno: issuer, sts: issuer },
        oauth: { clientId: 'registered-client-id', redirectUri: `${origin}/app`, scopes: ['openid', 'content:read'] },
    });
    void oauth.getAppOAuthToken();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    const authorize = new URL(replace.mock.calls[0][0]);
    expect(authorize.searchParams.get('client_id')).toBe('registered-client-id');
    expect(authorize.searchParams.get('scope')).toBe('openid content:read');
    expect(authorize.searchParams.has('consent_required')).toBe(false);
    expect(requests).toHaveLength(1);
});
