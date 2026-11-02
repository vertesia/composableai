import { type AuthTokenPayload, Permission } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { assertTokenPermissionClaims, InvalidTokenPermissionClaimsError } from './permission-validation.js';
import { readTokenPermissionClaims } from './permissions.js';

describe('normalized token permission claims', () => {
    it('distinguishes a legacy OAuth cap from authoritative empty grants', () => {
        const legacy = { permissions: [Permission.content_read] };
        expect(() => assertTokenPermissionClaims(legacy)).not.toThrow();
        expect(readTokenPermissionClaims(legacy)).toBeUndefined();
        expect(readTokenPermissionClaims({ permissions: [], account_permissions: [] })).toEqual({
            permissions: [],
            account_permissions: [],
        });
    });

    it('returns the original lists without sanitizing, copying, or resolving roles', () => {
        const token = Object.freeze({
            permissions: [Permission.content_read, Permission.account_user_manage, 'future:permission'],
            account_permissions: [Permission.account_user_manage],
        });
        Object.freeze(token.permissions);
        Object.freeze(token.account_permissions);
        assertTokenPermissionClaims(token);
        const claims = readTokenPermissionClaims(token);
        expect(claims?.permissions).toBe(token.permissions);
        expect(claims?.account_permissions).toBe(token.account_permissions);
    });

    it.each([
        { account_permissions: [] },
        { permissions: 'content:read', account_permissions: [] },
        { permissions: [], account_permissions: null },
        { permissions: [42], account_permissions: [] },
        { permissions: [''], account_permissions: [] },
        { permissions: ['content:read content:write'], account_permissions: [] },
        { permissions: [Permission.content_read, Permission.content_read], account_permissions: [] },
        {
            permissions: [Permission.content_read],
            account_permissions: [Permission.content_read, Permission.content_read],
        },
        { permissions: [Permission.content_read], account_permissions: [Permission.account_admin] },
        { permissions: [Permission.account_user_manage], account_permissions: [] },
    ])('rejects inconsistent normalized claims at the boundary instead of repairing them: %j', (token) => {
        const original = JSON.stringify(token);
        expect(() => assertTokenPermissionClaims(token as unknown as AuthTokenPayload)).toThrow(
            InvalidTokenPermissionClaimsError,
        );
        expect(JSON.stringify(token)).toBe(original);
    });

    it.each([null, 'token', []])('rejects a non-object payload: %j', (token) => {
        expect(() => assertTokenPermissionClaims(token as unknown as AuthTokenPayload)).toThrow(
            InvalidTokenPermissionClaimsError,
        );
    });

    it('validates nested delegated principals even inside an old-format outer token', () => {
        const token = {
            service_caller: {
                onBehalfOf: {
                    permissions: [Permission.account_user_manage],
                    account_permissions: [],
                },
            },
        } as unknown as AuthTokenPayload;
        expect(() => assertTokenPermissionClaims(token)).toThrow(InvalidTokenPermissionClaimsError);
    });
});
