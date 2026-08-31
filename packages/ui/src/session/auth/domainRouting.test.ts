import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it } from 'vitest';
import {
<<<<<<< HEAD
    centralAuthUrl,
    DEFAULT_CENTRAL_AUTH_URL,
=======
    centralAuthRedirectUrl,
>>>>>>> 933a4327 (fix(auth): preserve app launch selection (#2048))
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
