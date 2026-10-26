import { describe, expect, it } from 'vitest';
import { getOAuthTokenScopes, parseOAuthScope } from './index.js';

describe('parseOAuthScope', () => {
    it('decodes and deduplicates a standard space-delimited claim', () => {
        expect(parseOAuthScope(' openid  profile openid ')).toEqual(['openid', 'profile']);
    });

    it('returns no scopes for absent or malformed claims', () => {
        expect(parseOAuthScope(undefined)).toEqual([]);
        expect(parseOAuthScope(['openid'])).toEqual([]);
    });
});

describe('getOAuthTokenScopes', () => {
    it('decodes the standard claim', () => {
        expect(getOAuthTokenScopes({ scope: 'openid profile' })).toEqual(['openid', 'profile']);
    });

    it('accepts the legacy array when the standard claim is absent', () => {
        expect(getOAuthTokenScopes({ scopes: ['openid', 'profile', 'openid'] })).toEqual(['openid', 'profile']);
    });

    it('gives the standard claim precedence over a conflicting legacy array', () => {
        expect(getOAuthTokenScopes({ scope: 'openid', scopes: ['content:write'] })).toEqual(['openid']);
        expect(getOAuthTokenScopes({ scope: '', scopes: ['content:write'] })).toEqual([]);
    });

    it('fails closed for malformed claims', () => {
        expect(getOAuthTokenScopes(null)).toEqual([]);
        expect(getOAuthTokenScopes({ scope: ['openid'], scopes: ['content:write'] })).toEqual([]);
        expect(getOAuthTokenScopes({ scopes: ['openid profile', 42] })).toEqual([]);
    });
});
