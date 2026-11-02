import { describe, expect, it } from 'vitest';
import { Permission } from './access-control-values.js';
import { getOAuthPermissionScopes } from './oauth-scopes.js';

describe('getOAuthPermissionScopes', () => {
    it('allows API key metadata reads but not persistent credential administration', () => {
        const scopes = getOAuthPermissionScopes();

        expect(scopes).toContain(Permission.api_key_read);
        expect(scopes).not.toContain(Permission.api_key_create);
        expect(scopes).not.toContain(Permission.api_key_update);
        expect(scopes).not.toContain(Permission.api_key_delete);
        expect(scopes).not.toContain(Permission.api_key_secret_read);
    });

    it('does not let an OAuth client request who-has-access administration', () => {
        const scopes = getOAuthPermissionScopes();

        expect(scopes).not.toContain(Permission.project_membership_manage);
        expect(scopes).not.toContain(Permission.account_membership_manage);
        expect(scopes).not.toContain(Permission.account_oauth_client_manage);
        expect(scopes).not.toContain(Permission.account_project_manage);
    });
});
