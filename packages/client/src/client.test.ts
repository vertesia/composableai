import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isTokenExpired, VertesiaClient } from './client.js';

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
