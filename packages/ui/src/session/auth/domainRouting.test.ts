import { afterEach, describe, expect, it } from 'vitest';
import { mountRootUrl, shouldRedirectToCentralAuth, shouldUseFirebaseAuth } from './domainRouting';

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
