import { describe, expect, it } from 'vitest';
import type { StoredAuthBundle } from './keyring.js';
import type { ConfigResult } from './server/index.js';
import { readInlineTokenExpiry, readResultAccessTokenExpiry, readResultRefreshTokenExpiry } from './token-expiry.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function configResult(overrides: Partial<ConfigResult> = {}): ConfigResult {
    return {
        profile: 'dev',
        account: 'account-1',
        project: 'project-1',
        studio_server_url: 'https://studio.example.com',
        zeno_server_url: 'https://zeno.example.com',
        token: 'access-token',
        ...overrides,
    };
}

function bundle(overrides: Partial<StoredAuthBundle> = {}): StoredAuthBundle {
    return { version: 1, refreshToken: 'vrt_old', ...overrides };
}

function tokenWithPayload(payload: Record<string, unknown>): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `eyJhbGciOiJub25lIn0.${encodedPayload}.`;
}

describe('readInlineTokenExpiry', () => {
    it('accepts every finite numeric expiry, including the Unix epoch', () => {
        expect(readInlineTokenExpiry(tokenWithPayload({ exp: 0 }))).toBe(0);
        expect(readInlineTokenExpiry(tokenWithPayload({ exp: 123 }))).toBe(123_000);
    });

    it('rejects missing and non-numeric expiry claims', () => {
        expect(readInlineTokenExpiry(tokenWithPayload({}))).toBeUndefined();
        expect(readInlineTokenExpiry(tokenWithPayload({ exp: '123' }))).toBeUndefined();
        expect(readInlineTokenExpiry(tokenWithPayload({ exp: Number.POSITIVE_INFINITY }))).toBeUndefined();
    });
});

describe('readResultRefreshTokenExpiry', () => {
    it('dates a rotated refresh token from the lifetime the server reports', () => {
        const before = Date.now();
        const expiry = readResultRefreshTokenExpiry(
            configResult({ refresh_token: 'vrt_new', refresh_token_expires_in: 30 * 24 * 60 * 60 }),
            bundle({ refreshTokenExpiresAt: before - DAY_MS }),
        );

        expect(expiry).toBeDefined();
        // Bracketed rather than compared to a single instant: the helper reads its own `Date.now()`.
        expect(expiry).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
        expect(expiry).toBeLessThanOrEqual(Date.now() + 30 * DAY_MS);
    });

    it('prefers an absolute expiry when the result carries one', () => {
        const absolute = Date.now() + 7 * DAY_MS;
        expect(
            readResultRefreshTokenExpiry(
                configResult({
                    refresh_token: 'vrt_new',
                    refresh_token_expires_at: absolute,
                    refresh_token_expires_in: 30 * 24 * 60 * 60,
                }),
                bundle(),
            ),
        ).toBe(absolute);
    });

    it('does not carry the replaced token expiry onto a newly rotated refresh token', () => {
        // The regression: a server that returns a rotated token but no lifetime used to leave the
        // previous token's expiry in the bundle, so `vertesia auth details` eventually reported a
        // brand new credential as expired.
        const stale = Date.now() - DAY_MS;
        expect(
            readResultRefreshTokenExpiry(
                configResult({ refresh_token: 'vrt_new' }),
                bundle({ refreshTokenExpiresAt: stale }),
            ),
        ).toBeUndefined();
    });

    it('keeps the stored expiry when the result rotates nothing and the stored token survives', () => {
        const stored = Date.now() + 20 * DAY_MS;
        expect(readResultRefreshTokenExpiry(configResult(), bundle({ refreshTokenExpiresAt: stored }))).toBe(stored);
    });

    it('reports no expiry when there is neither a rotated token nor a stored one', () => {
        expect(readResultRefreshTokenExpiry(configResult(), undefined)).toBeUndefined();
    });
});

describe('readResultAccessTokenExpiry', () => {
    it('prefers an absolute expiry, then expires_in, then the token exp claim', () => {
        const absolute = Date.now() + 60_000;
        expect(readResultAccessTokenExpiry(configResult({ access_token_expires_at: absolute }))).toBe(absolute);

        const before = Date.now();
        const fromLifetime = readResultAccessTokenExpiry(configResult({ expires_in: 3600 }));
        expect(fromLifetime).toBeGreaterThanOrEqual(before + 3_600_000);
        expect(fromLifetime).toBeLessThanOrEqual(Date.now() + 3_600_000);

        // An opaque token with no lifetime information at all.
        expect(readResultAccessTokenExpiry(configResult())).toBeUndefined();
    });
});
