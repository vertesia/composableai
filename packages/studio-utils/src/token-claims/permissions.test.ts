import { type AuthTokenPayload, Permission } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { readTokenPermissionClaims } from './permissions.js';

function claims(value: Partial<AuthTokenPayload>) {
    return readTokenPermissionClaims(value as AuthTokenPayload);
}

describe('normalized token permission claims', () => {
    it('distinguishes legacy scope caps from authoritative permission lists', () => {
        expect(claims({ permissions: [Permission.content_read] })).toBeUndefined();
        expect(claims({ permissions: [], account_permissions: [] })).toEqual({
            permissions: [],
            account_permissions: [],
        });
    });

    it('deduplicates and requires account authority to be part of the effective authority', () => {
        expect(
            claims({
                permissions: [Permission.content_read, Permission.content_read],
                account_permissions: [Permission.account_admin],
            }),
        ).toEqual({ permissions: [Permission.content_read], account_permissions: [] });
    });

    it('does not turn project-only grants into account-only capabilities', () => {
        expect(
            claims({
                permissions: [Permission.content_read, Permission.account_user_manage],
                account_permissions: [],
            }),
        ).toEqual({ permissions: [Permission.content_read], account_permissions: [] });
    });

    it('retains valid account-only grants', () => {
        expect(
            claims({
                permissions: [Permission.account_user_manage],
                account_permissions: [Permission.account_user_manage],
            }),
        ).toEqual({
            permissions: [Permission.account_user_manage],
            account_permissions: [Permission.account_user_manage],
        });
    });

    it('fails closed for malformed normalized claims rather than falling back to roles', () => {
        expect(claims({ account_roles: ['admin'], account_permissions: null } as never)).toEqual({
            permissions: [],
            account_permissions: [],
        });
        expect(claims({ permissions: 'content:read', account_permissions: [] } as never)).toEqual({
            permissions: [],
            account_permissions: [],
        });
    });
});
