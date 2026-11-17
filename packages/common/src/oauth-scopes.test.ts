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

    it('lets a client request the management of content sources without every project setting', () => {
        const scopes = getOAuthPermissionScopes();

        expect(scopes).toContain(Permission.content_source_manage);
        expect(scopes).toContain(Permission.project_settings_write);
    });
});
