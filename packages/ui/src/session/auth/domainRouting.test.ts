import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it } from 'vitest';
import {
    centralAuthUrl,
    DEFAULT_CENTRAL_AUTH_URL,
    isCentralAuthRedirectPending,
    mountRootUrl,
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

describe('centralAuthUrl', () => {
    function initEnv(auth?: string) {
        Env.init({
            name: 'test',
            version: '0',
            isLocalDev: true,
            isDocker: false,
            type: 'development',
            endpoints: { studio: 'https://studio.test', zeno: 'https://zeno.test', sts: 'https://sts.test', auth },
        });
    }

    it('falls back to the default broker when no auth endpoint is configured', () => {
        initEnv(undefined);
        expect(centralAuthUrl()).toBe(DEFAULT_CENTRAL_AUTH_URL);
        expect(DEFAULT_CENTRAL_AUTH_URL).toBe('https://internal-auth.vertesia.app/');
    });

    it('uses the configured auth endpoint when one is set', () => {
        initEnv('https://auth.vertesia.io/');
        expect(centralAuthUrl()).toBe('https://auth.vertesia.io/');
    });

    // An empty string is what an unset VITE_* override collapses to; it must not become the broker
    // URL, or the app would redirect to its own origin instead of a login page.
    it('treats an empty auth endpoint as unconfigured', () => {
        initEnv('');
        expect(centralAuthUrl()).toBe(DEFAULT_CENTRAL_AUTH_URL);
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

    it('is false on a Firebase-allowlisted host, which signs in without the broker', () => {
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
