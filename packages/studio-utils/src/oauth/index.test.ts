import { describe, expect, it } from 'vitest';
import { parseOAuthScope } from './index.js';

describe('parseOAuthScope', () => {
    it('decodes and deduplicates a standard space-delimited claim', () => {
        expect(parseOAuthScope(' openid  profile openid ')).toEqual(['openid', 'profile']);
    });

    it('returns no scopes for absent or malformed claims', () => {
        expect(parseOAuthScope(undefined)).toEqual([]);
        expect(parseOAuthScope(['openid'])).toEqual([]);
    });
});
