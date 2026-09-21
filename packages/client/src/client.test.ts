import { APP_VERSION_HEADER } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { decodeJWT, isTokenExpired, VertesiaClient, type VertesiaClientProps } from './client.js';
import { ZenoClient, type ZenoClientProps } from './store/client.js';
import { resetUnknownOptionWarnings } from './unknown-options.js';

describe('Test Vertesia Client', () => {
    test('Initialization with studio and zeno URLs', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            tokenServerUrl: 'https://sts.vertesia.io',
            apikey: '1234',
        });
        expect(client).toBeDefined();
    });

    test('Initialization with studio URL only', () => {
        expect(() => {
            new VertesiaClient({
                serverUrl: 'https://api.vertesia.io',
                storeUrl: '',
            });
        }).toThrowError("Parameter 'site' or 'storeUrl' is required for VertesiaClient");
    });

    test('Initialization with zeno URL only', () => {
        expect(() => {
            new VertesiaClient({
                serverUrl: '',
                storeUrl: 'https://api.vertesia.io',
            });
        }).toThrowError("Parameter 'site' or 'serverUrl' is required for VertesiaClient");
    });

    test('Initialization with same site', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            site: 'api.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.vertesia.io');
        expect(client.storeUrl).toBe('https://api.vertesia.io');
    });

    test('Initialization with default parameters', () => {
        const client = new VertesiaClient();

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.vertesia.io');
        expect(client.storeUrl).toBe('https://api.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.vertesia.io');
    });

    test('Initialization with site api-preview.vertesia.io', () => {
        const client = new VertesiaClient({
            site: 'api-preview.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api-preview.vertesia.io');
        expect(client.storeUrl).toBe('https://api-preview.vertesia.io');
        // preview keeps its env segment: api-preview → sts-preview (its own STS)
        expect(client.tokenServerUrl).toBe('https://sts-preview.vertesia.io');
    });

    test('Initialization with site api.dev1.vertesia.io', () => {
        const client = new VertesiaClient({
            site: 'api.dev1.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.dev1.vertesia.io');
        expect(client.storeUrl).toBe('https://api.dev1.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.dev1.vertesia.io');
    });

    test('Initialization with site api-preview.dev1.vertesia.io', () => {
        const client = new VertesiaClient({
            site: 'api-preview.dev1.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api-preview.dev1.vertesia.io');
        expect(client.storeUrl).toBe('https://api-preview.dev1.vertesia.io');
        // preview keeps its env segment: api-preview → sts-preview (its own STS)
        expect(client.tokenServerUrl).toBe('https://sts-preview.dev1.vertesia.io');
    });

    test('Initialization with regional serverUrl (api.us1)', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.us1.vertesia.io',
            storeUrl: 'https://api.us1.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.us1.vertesia.io');
        expect(client.storeUrl).toBe('https://api.us1.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.us1.vertesia.io');
    });

    test('Initialization with regional serverUrl (api.eu1)', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.eu1.vertesia.io',
            storeUrl: 'https://api.eu1.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api.eu1.vertesia.io');
        expect(client.storeUrl).toBe('https://api.eu1.vertesia.io');
        expect(client.tokenServerUrl).toBe('https://sts.eu1.vertesia.io');
    });

    test('Initialization with regional preview serverUrl (api-preview.us1)', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api-preview.us1.vertesia.io',
            storeUrl: 'https://api-preview.us1.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://api-preview.us1.vertesia.io');
        // preview keeps its env segment: api-preview → sts-preview (its own versioned STS)
        expect(client.tokenServerUrl).toBe('https://sts-preview.us1.vertesia.io');
    });

    test('Initialization with site localhost', () => {
        const client = new VertesiaClient({
            serverUrl: 'http://localhost:8091',
            storeUrl: 'http://localhost:8092',
            tokenServerUrl: 'http://localhost:8093',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('http://localhost:8091');
        expect(client.storeUrl).toBe('http://localhost:8092');
    });

    test('Initialization with overrides', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://studio-server-production.api.becomposable.com',
            storeUrl: 'https://zeno-server-production.api.becomposable.com',
            site: 'api.vertesia.io',
        });

        expect(client).toBeDefined();
        expect(client.baseUrl).toBe('https://studio-server-production.api.becomposable.com');
        expect(client.storeUrl).toBe('https://zeno-server-production.api.becomposable.com');
    });

    test('withAppVersion keeps Studio and Store requests pinned together', () => {
        const client = new VertesiaClient({
            serverUrl: 'https://studio-server-production.api.becomposable.com',
            storeUrl: 'https://zeno-server-production.api.becomposable.com',
        });

        expect(client.withAppVersion('candidate-v1')).toBe(client);
        expect(client.headers[APP_VERSION_HEADER]).toBe('candidate-v1');
        expect(client.store.headers[APP_VERSION_HEADER]).toBe('candidate-v1');

        client.withAppVersion(null);
        expect(client.headers[APP_VERSION_HEADER]).toBeUndefined();
        expect(client.store.headers[APP_VERSION_HEADER]).toBeUndefined();
    });
});

describe('isTokenExpired', () => {
    // EXPIRATION_THRESHOLD inside client.ts is 60000ms (60s). Tokens with `exp`
    // less than 60s in the future are treated as expired so the caller refreshes
    // proactively.
    const REFRESH_WINDOW_MS = 60_000;
    const NOW_MS = 1_700_000_000_000;

    function base64UrlEncode(s: string): string {
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function makeToken(exp: number): string {
        const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
        const payload = base64UrlEncode(JSON.stringify({ exp }));
        return `${header}.${payload}.signature`;
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW_MS));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns true for a null token', () => {
        expect(isTokenExpired(null)).toBe(true);
    });

    test('returns false for a fresh token comfortably inside its lifetime', () => {
        // 1 hour in the future
        const exp = Math.floor(NOW_MS / 1000) + 3600;
        expect(isTokenExpired(makeToken(exp))).toBe(false);
    });

    test('returns true when the token is within the refresh threshold of expiry', () => {
        // 30s in the future — inside the 60s refresh window
        const exp = Math.floor((NOW_MS + 30_000) / 1000);
        expect(isTokenExpired(makeToken(exp))).toBe(true);
    });

    test('returns true for a token whose exp is already in the past', () => {
        // expired 100s ago
        const exp = Math.floor((NOW_MS - 100_000) / 1000);
        expect(isTokenExpired(makeToken(exp))).toBe(true);
    });

    test('returns true exactly at the refresh-window boundary', () => {
        // exp is exactly REFRESH_WINDOW_MS in the future — should already trigger refresh
        const exp = Math.floor((NOW_MS + REFRESH_WINDOW_MS) / 1000);
        expect(isTokenExpired(makeToken(exp))).toBe(true);
    });
});

describe('unknown constructor options', () => {
    // Model the real escape hatch rather than a cast: TypeScript's excess-property check only fires
    // on an object literal, so a spread of a wider config object reaches the constructor unchecked.
    function optionsWith(extra: Record<string, unknown>): VertesiaClientProps {
        return {
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            ...extra,
        } as VertesiaClientProps;
    }

    beforeEach(() => {
        resetUnknownOptionWarnings();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // The option names below are deliberately spelled the way the SDK does NOT accept them. Passing
    // them used to produce a client that looked fine and then failed every request with
    // `401 Unauthorized: Authorization token is required`, with nothing pointing at the constructor.
    test('names the option and what the caller meant', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        new VertesiaClient(optionsWith({ token: 'jwt' }));

        expect(warn).toHaveBeenCalledTimes(1);
        const message = warn.mock.calls[0][0] as string;
        expect(message).toContain('[VertesiaClient]');
        expect(message).toContain('token');
        expect(message).toContain('`apikey`');
    });

    test('reports each unknown option once, not once per client', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const opts = optionsWith({ appVersion: 'v1' });

        new VertesiaClient(opts);
        new VertesiaClient(opts);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('withAppVersion');
    });

    test('stays silent for a fully valid options object', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        new VertesiaClient({
            serverUrl: 'https://api.vertesia.io',
            storeUrl: 'https://api.vertesia.io',
            tokenServerUrl: 'https://sts.vertesia.io',
            apikey: 'sk-1234',
            sessionTags: 'test',
            timeout: 1000,
        });

        expect(warn).not.toHaveBeenCalled();
    });

    // `key in known` would treat these as known options, because every object inherits them.
    test.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])(
        'reports %s, which is inherited from Object.prototype',
        (key) => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            new VertesiaClient(optionsWith({ [key]: 'whatever' }));

            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain(key);
        },
    );

    test('covers the store client too', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        new ZenoClient({
            serverUrl: 'https://api.vertesia.io',
            ...{ apiKey: 'sk-1234' },
        } as ZenoClientProps);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('[ZenoClient]');
        expect(warn.mock.calls[0][0]).toContain('apikey');
    });
});

describe('decodeJWT', () => {
    // An empty or non-JWT credential used to reach `''.split('.')[1]` and die inside the base64
    // decoder with a TypeError naming neither the token nor the caller.
    test.each([
        ['an empty string', ''],
        ['an API key', 'sk-abcdef'],
        ['a two-segment string', 'header.payload'],
    ])('names the failure for %s', (_label, value) => {
        expect(() => decodeJWT(value)).toThrowError(/Invalid auth token: expected a JWT/);
    });

    test('names a payload that is not JSON', () => {
        expect(() => decodeJWT('aGVhZGVy.bm90LWpzb24.sig')).toThrowError(
            'Invalid auth token: payload segment is not JSON',
        );
    });

    test('rejects an empty token before decoding it', async () => {
        await expect(VertesiaClient.fromAuthToken('   ')).rejects.toThrowError(
            'VertesiaClient.fromAuthToken requires a non-empty auth token',
        );
    });
});
