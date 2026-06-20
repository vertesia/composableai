import { afterEach, describe, expect, it } from 'vitest';
import { authReturnUrl, shouldRedirectToCentralAuth, shouldUseFirebaseAuth } from './domainRouting';

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
});

describe('authReturnUrl', () => {
    const setLocation = (href: string, baseURI: string) => {
        (globalThis as { window?: unknown }).window = { location: { href } };
        (globalThis as { document?: unknown }).document = { baseURI };
    };

    afterEach(() => {
        delete (globalThis as { window?: unknown }).window;
        delete (globalThis as { document?: unknown }).document;
    });

    it('recovers the gateway mount when the router clobbered the address to the origin', () => {
        // App served under a deep mount; <base href> carries the mount, but the router rewrote
        // window.location to the bare origin before auth ran.
        const mount = 'https://app-gateway-dev1.api.dev1.vertesia.io/tenants/05948c_5ed5f4/apps/furniture-catalog/versions/20260618T170907892Z/app/';
        setLocation('https://app-gateway-dev1.api.dev1.vertesia.io/', mount);
        expect(authReturnUrl().toString()).toBe(mount);
    });

    it('preserves the in-app deep route when the location still sits under the mount', () => {
        const mount = 'https://gw.example.com/tenants/t/apps/a/app/';
        setLocation('https://gw.example.com/tenants/t/apps/a/app/items/5', mount);
        expect(authReturnUrl().toString()).toBe('https://gw.example.com/tenants/t/apps/a/app/items/5');
    });

    it('leaves the Studio UI (no base mount) on its current deep route', () => {
        // No <base> element → document.baseURI is the document URL.
        setLocation('https://cloud.vertesia.io/agents/123', 'https://cloud.vertesia.io/agents/123');
        expect(authReturnUrl().toString()).toBe('https://cloud.vertesia.io/agents/123');
    });

    it('strips the hash from the return URL', () => {
        setLocation('https://cloud.vertesia.io/page#token=abc&state=xyz', 'https://cloud.vertesia.io/page');
        expect(authReturnUrl().toString()).toBe('https://cloud.vertesia.io/page');
    });
});
