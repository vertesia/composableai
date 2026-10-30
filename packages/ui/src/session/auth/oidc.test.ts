// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const origin = 'https://auth.gov.example.com';
const issuer = 'https://example.okta.com/oauth2/default';
const clientId = '0oa-test-client';
const tokenEndpoint = `${issuer}/v1/token`;
const storage = new Map<string, string>();
const assign = vi.fn();

/** Return a value the test needs, failing with a readable message when it is missing. */
function present<T>(value: T | null | undefined, what: string): T {
    if (value == null) throw new Error(`expected ${what} to be present`);
    return value;
}
// Transform the module graph once, before the per-test deadlines start.
beforeAll(async () => {
    await import('./oidc');
}, 30_000);
let browser: {
    location: { href: string; origin: string; pathname: string; search: string; assign: typeof assign };
    history: { state: null; replaceState: ReturnType<typeof vi.fn> };
};
let tokenResponse: () => Response;
let discoveryIssuer: string;

function idToken(claims: Record<string, unknown> = {}): string {
    return `e30.${btoa(
        JSON.stringify({ iss: issuer, aud: clientId, sub: 'user', exp: Date.now() / 1000 + 3600, ...claims }),
    )}.signature`;
}

function navigate(href: string) {
    const url = new URL(href, origin);
    browser.location.href = url.toString();
    browser.location.pathname = url.pathname;
    browser.location.search = url.search;
}

async function setup(oidc: { issuer: string; clientId: string; scopes?: string[] } | null = { issuer, clientId }) {
    vi.resetModules();
    const { Env } = await import('../../env');
    Env.init({
        name: 'test',
        version: '1',
        type: 'production',
        isLocalDev: false,
        isDocker: false,
        endpoints: { studio: 'https://api.gov.example.com', zeno: 'https://api.gov.example.com', sts: 'https://sts' },
        oidc: oidc ?? undefined,
    });
    return import('./oidc');
}

/** Start a sign-in and come back to the callback with the state and code the provider would return. */
async function signInAndReturn(oidc: Awaited<ReturnType<typeof setup>>, query?: Record<string, string>) {
    await oidc.startOidcSignIn({ returnTo: '/app/report?x=1#chart' });
    const authorize = new URL(assign.mock.calls[0][0]);
    const params = new URLSearchParams(
        query ?? { code: 'one-time-code', state: present(authorize.searchParams.get('state'), 'the state parameter') },
    );
    navigate(`/oidc/callback?${params}`);
    return authorize;
}

beforeEach(() => {
    storage.clear();
    discoveryIssuer = issuer;
    tokenResponse = () => Response.json({ error: 'not_set_by_test' }, { status: 500 });
    browser = {
        location: { href: '', origin, pathname: '', search: '', assign },
        history: {
            state: null,
            replaceState: vi.fn((_state, _title, target: string) => navigate(target)),
        },
    };
    navigate('/app/report?x=1#chart');
    vi.stubGlobal('window', browser);
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            const url = String(input);
            if (url === `${issuer}/.well-known/openid-configuration`)
                return Response.json({
                    issuer: discoveryIssuer,
                    authorization_endpoint: `${issuer}/v1/authorize`,
                    token_endpoint: tokenEndpoint,
                });
            if (url === tokenEndpoint) return tokenResponse();
            throw new Error(`Unexpected request: ${url}`);
        }),
    );
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

it('is off without an OIDC configuration', async () => {
    const oidc = await setup(null);
    expect(oidc.usesOidcSignIn()).toBe(false);
    navigate('/oidc/callback?code=c&state=s');
    await expect(oidc.completeOidcSignIn()).resolves.toBe(false);
    await expect(oidc.startOidcSignIn()).rejects.toThrow('not configured');
});

it('sends the user to the provider with PKCE, state, nonce and the same-origin callback', async () => {
    const oidc = await setup();
    expect(oidc.usesOidcSignIn()).toBe(true);
    await oidc.startOidcSignIn({ loginHint: 'jane@agency.gov' });
    const authorize = new URL(assign.mock.calls[0][0]);
    expect(`${authorize.origin}${authorize.pathname}`).toBe(`${issuer}/v1/authorize`);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: `${origin}/oidc/callback`,
        scope: 'openid email profile',
        code_challenge_method: 'S256',
        login_hint: 'jane@agency.gov',
    });
    const transaction = JSON.parse(present(storage.get('vertesia.oidc.transaction'), 'the OIDC transaction'));
    expect(authorize.searchParams.get('state')).toBe(transaction.state);
    expect(authorize.searchParams.get('nonce')).toBe(transaction.nonce);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier));
    const challenge = Buffer.from(digest).toString('base64url');
    expect(authorize.searchParams.get('code_challenge')).toBe(challenge);
    expect(transaction.returnTo).toBe(`${origin}/app/report?x=1#chart`);
});

it('refuses a cross-origin return target and a discovery document for another issuer', async () => {
    const oidc = await setup();
    await expect(oidc.startOidcSignIn({ returnTo: 'https://evil.example.com/' })).rejects.toThrow('same-origin');
    discoveryIssuer = 'https://evil.example.com';
    const other = await setup();
    await expect(other.startOidcSignIn()).rejects.toThrow('another issuer');
    expect(assign).not.toHaveBeenCalled();
});

it('exchanges the code once, stores the ID token and restores the page the sign-in started from', async () => {
    const oidc = await setup();
    await signInAndReturn(oidc);
    const { verifier, nonce } = JSON.parse(present(storage.get('vertesia.oidc.transaction'), 'the OIDC transaction'));
    tokenResponse = () => Response.json({ id_token: idToken({ nonce }), token_type: 'Bearer' });

    await expect(oidc.completeOidcSignIn()).resolves.toBe(true);
    expect(browser.location.href).toBe(`${origin}/app/report?x=1#chart`);
    const exchange = present(
        vi.mocked(fetch).mock.calls.find(([url]) => String(url) === tokenEndpoint),
        'the token exchange request',
    );
    expect(Object.fromEntries(present(exchange[1], 'the token exchange options').body as URLSearchParams)).toEqual({
        grant_type: 'authorization_code',
        code: 'one-time-code',
        redirect_uri: `${origin}/oidc/callback`,
        client_id: clientId,
        code_verifier: verifier,
    });
    expect(oidc.getOidcIdToken()).toBe(
        JSON.parse(present(storage.get('vertesia.oidc.id_token'), 'the stored ID token')).idToken,
    );
    expect(storage.has('vertesia.oidc.transaction')).toBe(false);

    // A replayed callback has no transaction left to match.
    navigate('/oidc/callback?code=one-time-code&state=x');
    await expect(oidc.completeOidcSignIn()).rejects.toThrow('Invalid or expired sign-in state');
});

it('gives a caller arriving during the exchange the same completion, not a signed-out page', async () => {
    const oidc = await setup();
    await signInAndReturn(oidc);
    const { nonce } = JSON.parse(present(storage.get('vertesia.oidc.transaction'), 'the OIDC transaction'));
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
        release = resolve;
    });
    tokenResponse = () => Response.json({ id_token: idToken({ nonce }) });
    vi.mocked(fetch).mockImplementation(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === tokenEndpoint) {
            await released;
            return tokenResponse();
        }
        return Response.json({
            issuer,
            authorization_endpoint: `${issuer}/v1/authorize`,
            token_endpoint: tokenEndpoint,
        });
    });

    const first = oidc.completeOidcSignIn();
    // The first call has already left the callback URL; a second one must not read that as no sign-in.
    expect(browser.location.pathname).toBe('/app/report');
    const second = oidc.completeOidcSignIn();
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === tokenEndpoint)).toHaveLength(1);
    // Once settled, a later call is an ordinary page again.
    await expect(oidc.completeOidcSignIn()).resolves.toBe(false);
});

it('does nothing outside the callback path', async () => {
    const oidc = await setup();
    await expect(oidc.completeOidcSignIn()).resolves.toBe(false);
    expect(browser.history.replaceState).not.toHaveBeenCalled();
});

describe('rejects a callback that does not belong to this sign-in', () => {
    it('a different state', async () => {
        const oidc = await setup();
        await signInAndReturn(oidc, { code: 'c', state: 'forged' });
        await expect(oidc.completeOidcSignIn()).rejects.toThrow('Invalid or expired sign-in state');
        // The callback URL, which carries the code, is left either way.
        expect(browser.location.pathname).toBe('/app/report');
        expect(oidc.getOidcIdToken()).toBeUndefined();
    });

    it('a provider error', async () => {
        const oidc = await setup();
        await oidc.startOidcSignIn();
        const state = present(new URL(assign.mock.calls[0][0]).searchParams.get('state'), 'the state parameter');
        navigate(`/oidc/callback?${new URLSearchParams({ error: 'access_denied', state })}`);
        await expect(oidc.completeOidcSignIn()).rejects.toThrow('access_denied');
    });

    it.each([
        ['another issuer', { iss: 'https://evil.example.com' }],
        ['another audience', { aud: 'other-client' }],
        ['another nonce', { nonce: 'replayed' }],
        ['an expired token', { exp: Date.now() / 1000 - 10 }],
    ])('an ID token with %s', async (_label, claims) => {
        const oidc = await setup();
        await signInAndReturn(oidc);
        const { nonce } = JSON.parse(present(storage.get('vertesia.oidc.transaction'), 'the OIDC transaction'));
        tokenResponse = () => Response.json({ id_token: idToken({ nonce, ...claims }) });
        await expect(oidc.completeOidcSignIn()).rejects.toThrow('not issued for this sign-in');
        expect(oidc.getOidcIdToken()).toBeUndefined();
    });

    it('a refused exchange', async () => {
        const oidc = await setup();
        await signInAndReturn(oidc);
        tokenResponse = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
        await expect(oidc.completeOidcSignIn()).rejects.toThrow('invalid_grant');
    });
});

it('accepts an audience list that includes the client and the matching nonce', async () => {
    const oidc = await setup();
    await signInAndReturn(oidc);
    const { nonce } = JSON.parse(present(storage.get('vertesia.oidc.transaction'), 'the OIDC transaction'));
    tokenResponse = () => Response.json({ id_token: idToken({ nonce, aud: ['api', clientId] }) });
    await expect(oidc.completeOidcSignIn()).resolves.toBe(true);
});

it('stops handing out a token close to its expiry, and forgets it on sign-out', async () => {
    const oidc = await setup();
    const stored = (exp: number) =>
        storage.set('vertesia.oidc.id_token', JSON.stringify({ idToken: 'tok', issuer, clientId, exp }));
    stored(Date.now() / 1000 + 20);
    expect(oidc.getOidcIdToken()).toBeUndefined();
    expect(storage.has('vertesia.oidc.id_token')).toBe(false);

    stored(Date.now() / 1000 + 600);
    expect(oidc.getOidcIdToken()).toBe('tok');
    oidc.clearOidcSession();
    expect(oidc.getOidcIdToken()).toBeUndefined();
});

it('ignores a token stored for another provider configuration', async () => {
    const oidc = await setup({ issuer, clientId: 'another-client' });
    storage.set(
        'vertesia.oidc.id_token',
        JSON.stringify({ idToken: 'tok', issuer, clientId, exp: Date.now() / 1000 + 600 }),
    );
    expect(oidc.getOidcIdToken()).toBeUndefined();
});
