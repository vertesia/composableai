import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    centralAuthRedirectUrl,
    clearCentralAuthRoundTripMarker,
    isCentralAuthRedirectPending,
    markCentralAuthRoundTripStarted,
    mountRootUrl,
    redirectToCentralAuth,
    shouldRedirectToCentralAuth,
    shouldUseFirebaseAuth,
} from './domainRouting';

// Stub document.baseURI to simulate the served `<base href>` (deep gateway mount) or its absence.
function setBaseURI(baseURI: string) {
    (globalThis as { document?: unknown }).document = { baseURI };
}

describe('domainRouting', () => {
    afterEach(() => {
        delete (globalThis as { window?: unknown }).window;
        delete (globalThis as { document?: unknown }).document;
    });

    it("uses Firebase auth when AUTH_MODE is 'firebase'", () => {
        (globalThis as { window?: unknown }).window = { AUTH_MODE: 'firebase' };
        expect(shouldUseFirebaseAuth()).toBe(true);
        expect(shouldRedirectToCentralAuth()).toBe(false);
    });

    it("uses central auth when AUTH_MODE is 'central'", () => {
        (globalThis as { window?: unknown }).window = { AUTH_MODE: 'central' };
        expect(shouldUseFirebaseAuth()).toBe(false);
        expect(shouldRedirectToCentralAuth()).toBe(true);
    });

    it('defaults to central auth when AUTH_MODE is not set', () => {
        (globalThis as { window?: unknown }).window = {};
        expect(shouldUseFirebaseAuth()).toBe(false);
        expect(shouldRedirectToCentralAuth()).toBe(true);
    });

    it('carries the selected account and project through central auth for a gateway-mounted app', () => {
        const redirect = centralAuthRedirectUrl({
            centralAuthUrl: 'https://internal-auth.vertesia.app/',
            stsEndpoint: 'https://sts.example.test',
            returnUrl: new URL('https://apps.example.test/tenants/t/apps/a/versions/v/app/?view=grid'),
            state: 'state-1',
            accountId: 'account-1',
            projectId: 'project-1',
        });
        const returnUrl = new URL(redirect.searchParams.get('redirect_uri') || '');

        expect(redirect.searchParams.get('sts')).toBe('https://sts.example.test');
        expect(redirect.searchParams.get('state')).toBe('state-1');
        expect(returnUrl.toString()).toBe(
            'https://apps.example.test/tenants/t/apps/a/versions/v/app/?view=grid&p=project-1&a=account-1',
        );
    });

    describe('mountRootUrl', () => {
        it('returns the deep gateway mount root (dropping any deep route / query / hash)', () => {
            const mount = 'https://gw.example.com/tenants/05948c_5ed5f4/apps/furniture-catalog/versions/v1/app/';
            setBaseURI(mount);
            expect(mountRootUrl().toString()).toBe(mount);
        });

        it('strips an existing query and hash so callers control the reload target', () => {
            setBaseURI('https://gw.example.com/tenants/t/apps/a/versions/v/app/');
            const url = mountRootUrl();
            url.searchParams.set('a', 'acct1');
            url.searchParams.set('p', 'proj1');
            expect(url.toString()).toBe('https://gw.example.com/tenants/t/apps/a/versions/v/app/?a=acct1&p=proj1');
        });

        it('is the origin root for the Studio UI (no <base> element)', () => {
            setBaseURI('https://studio.vertesia.io/');
            expect(mountRootUrl().toString()).toBe('https://studio.vertesia.io/');
        });
    });
});

// The boot-time counterpart of the redirect UserSessionProvider performs after mounting. It must
// answer true only when that provider is certain to redirect, because an app's entry module skips
// the whole React tree on the strength of it -- and false whenever the answer is not certain, which
// only costs the (current) wasted boot.
describe('isCentralAuthRedirectPending', () => {
    function initEnv(props: {
        isLocalDev?: boolean;
        devAuthToken?: string;
        authTokenProvider?: () => Promise<string>;
    }) {
        Env.init({
            name: 'test',
            version: '0',
            isDocker: false,
            type: 'development',
            isLocalDev: props.isLocalDev ?? false,
            devAuthToken: props.devAuthToken,
            authTokenProvider: props.authTokenProvider,
            endpoints: { studio: 'https://studio.test', zeno: 'https://zeno.test', sts: 'https://sts.test' },
        });
    }

    function setLocation(hash: string) {
        (globalThis as { window?: unknown }).window = { AUTH_MODE: 'central', location: { hash } };
    }

    afterEach(() => {
        delete (globalThis as { window?: unknown }).window;
    });

    it('is true for a plain cold load in central-auth mode', () => {
        initEnv({});
        setLocation('');
        expect(isCentralAuthRedirectPending()).toBe(true);
    });

    it('is false when AUTH_MODE is firebase, which signs in without the broker', () => {
        initEnv({});
        (globalThis as { window?: unknown }).window = { AUTH_MODE: 'firebase', location: { hash: '' } };
        expect(isCentralAuthRedirectPending()).toBe(false);
    });

    it('is false on the return leg carrying both token and state', () => {
        initEnv({});
        setLocation('#token=abc&state=xyz');
        expect(isCentralAuthRedirectPending()).toBe(false);
    });

    // A hash with only one half of the pair is not a usable return leg: UserSessionProvider falls
    // through to a fresh redirect, so the shortcut must agree.
    it('is true when the hash carries a token but no state', () => {
        initEnv({});
        setLocation('#token=abc');
        expect(isCentralAuthRedirectPending()).toBe(true);
    });

    it('is true when the hash carries a state but no token', () => {
        initEnv({});
        setLocation('#state=xyz');
        expect(isCentralAuthRedirectPending()).toBe(true);
    });

    it('is false when a host app injects a token provider', () => {
        initEnv({ authTokenProvider: async () => 'injected' });
        setLocation('');
        expect(isCentralAuthRedirectPending()).toBe(false);
    });

    it('is false in local development with a dev auth token', () => {
        initEnv({ isLocalDev: true, devAuthToken: 'dev-token' });
        setLocation('');
        expect(isCentralAuthRedirectPending()).toBe(false);
    });

    it('is true in local development without a dev auth token', () => {
        initEnv({ isLocalDev: true });
        setLocation('');
        expect(isCentralAuthRedirectPending()).toBe(true);
    });
});

// The marker exists for a server that generates the page: it is the only way to tell the leg that
// is about to redirect from the leg that came back, since the token returns in the URL fragment and
// never reaches a server. Its exact attributes are the contract -- a cookie the browser refuses to
// store, or one that is not sent on the top-level navigation back from the broker, degrades to "no
// marker" silently and costs a round-trip on every load instead.
describe('central auth round-trip marker', () => {
    function setProtocol(protocol: string): { cookie: string } {
        const document = { cookie: '' };
        (globalThis as { window?: unknown }).window = { location: { protocol } };
        (globalThis as { document?: unknown }).document = document;
        return document;
    }

    afterEach(() => {
        delete (globalThis as { window?: unknown }).window;
        delete (globalThis as { document?: unknown }).document;
    });

    it('sets a short-lived, root-scoped cookie that survives the navigation back from the broker', () => {
        const document = setProtocol('https:');
        markCentralAuthRoundTripStarted();
        // Lax, not Strict: the return leg is a cross-site top-level GET, which Strict would drop.
        expect(document.cookie).toBe('vtsauth=1; Path=/; Max-Age=300; SameSite=Lax; Secure');
    });

    it('omits Secure over http so local development keeps the marker', () => {
        const document = setProtocol('http:');
        markCentralAuthRoundTripStarted();
        expect(document.cookie).toBe('vtsauth=1; Path=/; Max-Age=300; SameSite=Lax');
    });

    it('expires the cookie on the same path when the app mounts', () => {
        const document = setProtocol('https:');
        clearCentralAuthRoundTripMarker();
        // Same name and Path, or the browser keeps the original cookie alongside this one.
        expect(document.cookie).toBe('vtsauth=; Path=/; Max-Age=0; SameSite=Lax; Secure');
    });
});

// The shared redirect must preserve release/1.5's gateway selection and write state that
// the provider's hook accepts when the broker returns.
describe('redirectToCentralAuth', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        sessionStorage.clear();
        Env.init();
    });

    it('keeps the gateway mount and selection, records state, and marks the round trip before navigating', async () => {
        const { verifyAuthState, clearAuthState } = await import('./authState');
        const mount = 'https://apps.test/tenants/t/apps/a/versions/v/app/';
        const document = { baseURI: mount, cookie: '' };
        const replace = vi.fn((target: string) => {
            const url = new URL(target);
            expect(document.cookie).toBe('vtsauth=1; Path=/; Max-Age=300; SameSite=Lax; Secure');
            expect(verifyAuthState(url.searchParams.get('state'))).toBeUndefined();
        });
        vi.stubGlobal('window', { location: { href: 'https://apps.test/?view=grid#old', protocol: 'https:' } });
        vi.stubGlobal('document', document);
        vi.stubGlobal('location', { replace });
        Env.init({
            name: 'test',
            version: '0',
            isLocalDev: false,
            isDocker: false,
            type: 'production',
            endpoints: { studio: 'https://studio.test', zeno: 'https://zeno.test', sts: 'https://sts.test/?x=1&y=2' },
        });

        redirectToCentralAuth({ accountId: 'account-1', projectId: 'project-1' });

        expect(replace).toHaveBeenCalledOnce();
        const url = new URL(replace.mock.calls[0][0]);
        expect(url.origin).toBe('https://internal-auth.vertesia.app');
        expect(url.searchParams.get('sts')).toBe('https://sts.test/?x=1&y=2');
        expect(url.searchParams.get('redirect_uri')).toBe(`${mount}?p=project-1&a=account-1`);
        expect(verifyAuthState('wrong')).toContain('State mismatched');
        clearAuthState();
        expect(verifyAuthState(url.searchParams.get('state'))).toContain('State mismatched');
    });
});
