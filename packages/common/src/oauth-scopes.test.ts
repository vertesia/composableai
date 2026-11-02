import { describe, expect, it } from 'vitest';
import { Permission } from './access-control-values.js';
import { getAppOAuthPermissionScopes, getOAuthPermissionScopes } from './oauth-scopes.js';

describe('getOAuthPermissionScopes', () => {
    it('excludes approval authority from the app runtime permission list', () => {
        expect(getAppOAuthPermissionScopes()).not.toContain(Permission.app_oauth_approve);
        expect(getAppOAuthPermissionScopes()).toContain(Permission.content_read);
    });
    it('allows explicit delegation of app approval without delegating a console session', () => {
        expect(getOAuthPermissionScopes()).toContain(Permission.app_oauth_approve);
        expect(getOAuthPermissionScopes()).not.toContain('vertesia:session');
        expect(getOAuthPermissionScopes()).not.toContain('vertesia:admin-session');
    });
    it('allows API key metadata reads but not persistent credential administration', () => {
        const scopes = getOAuthPermissionScopes();

        expect(scopes).toContain(Permission.api_key_read);
        expect(scopes).not.toContain(Permission.api_key_create);
        expect(scopes).not.toContain(Permission.api_key_update);
        expect(scopes).not.toContain(Permission.api_key_delete);
        expect(scopes).not.toContain(Permission.api_key_secret_read);
    });
});
