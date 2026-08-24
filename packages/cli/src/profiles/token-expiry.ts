import jwt from 'jsonwebtoken';
import type { StoredAuthBundle } from './keyring.js';
import type { ConfigResult } from './server/index.js';

/**
 * Absolute expiry carried by a JWT's own `exp` claim, in milliseconds.
 *
 * Returns `undefined` for an opaque token — refresh tokens issued by the STS are opaque, so their
 * lifetime can only come from the authorization server's response.
 */
export function readInlineTokenExpiry(token: string): number | undefined {
    const decoded = jwt.decode(token, { json: true });
    if (typeof decoded?.exp !== 'number' || !Number.isFinite(decoded.exp)) {
        return undefined;
    }
    return decoded.exp * 1000;
}

export function readResultAccessTokenExpiry(result: ConfigResult): number | undefined {
    if (typeof result.access_token_expires_at === 'number') {
        return result.access_token_expires_at;
    }
    if (typeof result.expires_in === 'number') {
        return Date.now() + result.expires_in * 1000;
    }
    return readInlineTokenExpiry(result.token);
}

/**
 * Absolute expiry to store for the refresh token this result leaves in the bundle.
 *
 * The refresh grant rotates: whenever the server returns a `refresh_token` it is a brand new
 * credential with its own lifetime, so the previous bundle's expiry describes a token that no longer
 * exists and must not be carried over — doing so would eventually mark a freshly issued token as
 * expired. The stored value is only reused when the result carries no refresh token at all and the
 * bundle's token survives untouched.
 */
export function readResultRefreshTokenExpiry(
    result: ConfigResult,
    previousBundle?: StoredAuthBundle,
): number | undefined {
    if (!result.refresh_token) {
        return previousBundle?.refreshTokenExpiresAt;
    }
    if (typeof result.refresh_token_expires_at === 'number') {
        return result.refresh_token_expires_at;
    }
    if (typeof result.refresh_token_expires_in === 'number') {
        return Date.now() + result.refresh_token_expires_in * 1000;
    }
    // An authorization server that reports no refresh lifetime: unknown beats stale.
    return undefined;
}
