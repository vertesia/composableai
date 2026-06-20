import { afterEach, describe, expect, it } from 'vitest';
import { getMountBasename, joinPath, stripMountBasename, withMountBasename } from './path';

// Simulate a served `<base href>` (or its absence) by stubbing document.querySelector + document.URL.
function setBaseHref(href: string | null, docUrl = 'https://gw.example.com/x') {
    (globalThis as { document?: unknown }).document = {
        URL: docUrl,
        querySelector: (sel: string) =>
            sel === 'base[href]' && href ? ({ href: new URL(href, docUrl).href } as unknown) : null,
    };
}

const MOUNT = '/tenants/05948c_5ed5f4/apps/furniture-catalog/versions/20260620T064257113Z/app';

describe('mount basename helpers', () => {
    afterEach(() => {
        delete (globalThis as { document?: unknown }).document;
    });

    describe('getMountBasename', () => {
        it('returns the base path (no trailing slash) when a deep <base href> is present', () => {
            setBaseHref(`${MOUNT}/`);
            expect(getMountBasename()).toBe(MOUNT);
        });
        it('returns "" for the Studio UI (no <base> element)', () => {
            setBaseHref(null);
            expect(getMountBasename()).toBe('');
        });
        it('returns "" for a root <base href="/">', () => {
            setBaseHref('/');
            expect(getMountBasename()).toBe('');
        });
        it('returns "" when there is no document (SSR)', () => {
            delete (globalThis as { document?: unknown }).document;
            expect(getMountBasename()).toBe('');
        });
    });

    describe('withMountBasename (navigate side)', () => {
        it('prepends the mount to an absolute app route', () => {
            setBaseHref(`${MOUNT}/`);
            expect(withMountBasename('/assistant')).toBe(`${MOUNT}/assistant`);
            expect(withMountBasename('/')).toBe(`${MOUNT}/`);
        });
        it('does not double-prepend a path already under the mount', () => {
            setBaseHref(`${MOUNT}/`);
            expect(withMountBasename(`${MOUNT}/items/5`)).toBe(`${MOUNT}/items/5`);
            expect(withMountBasename(MOUNT)).toBe(MOUNT);
        });
        it('leaves relative paths untouched', () => {
            setBaseHref(`${MOUNT}/`);
            expect(withMountBasename('assistant')).toBe('assistant');
        });
        it('is a no-op for the Studio UI (no mount)', () => {
            setBaseHref(null);
            expect(withMountBasename('/assistant')).toBe('/assistant');
            expect(withMountBasename('/')).toBe('/');
        });
    });

    describe('stripMountBasename (match side)', () => {
        it('strips the mount so route patterns match app-relative', () => {
            setBaseHref(`${MOUNT}/`);
            expect(stripMountBasename(`${MOUNT}/assistant`)).toBe('/assistant');
            expect(stripMountBasename(MOUNT)).toBe('/');
            expect(stripMountBasename(`${MOUNT}/`)).toBe('/');
        });
        it('leaves a path not under the mount untouched', () => {
            setBaseHref(`${MOUNT}/`);
            expect(stripMountBasename('/somewhere-else')).toBe('/somewhere-else');
        });
        it('is a no-op for the Studio UI (no mount)', () => {
            setBaseHref(null);
            expect(stripMountBasename('/agents/123')).toBe('/agents/123');
            expect(stripMountBasename('/')).toBe('/');
        });
    });

    it('round-trips: strip(with(route)) === route under a mount', () => {
        setBaseHref(`${MOUNT}/`);
        for (const route of ['/', '/assistant', '/items/5']) {
            expect(stripMountBasename(withMountBasename(route))).toBe(route === '/' ? '/' : route);
        }
        // sanity: joinPath stays available/correct
        expect(joinPath(MOUNT, '/assistant')).toBe(`${MOUNT}/assistant`);
    });
});
