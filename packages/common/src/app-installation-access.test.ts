import { describe, expect, it } from 'vitest';
import { type AuthTokenPayload, PrincipalType } from './apikey.js';
import { hasAppInstallationAccess } from './apps.js';

const installation = {
    id: 'eu-install',
    project: 'project',
    instance_key: 'eu',
    manifest: { name: 'salesforce' },
};
function token(overrides: Partial<AuthTokenPayload> = {}): AuthTokenPayload {
    return {
        sub: 'user',
        name: 'User',
        type: PrincipalType.User,
        account: { id: 'account', name: 'Account' },
        accounts: [],
        account_roles: [],
        project: { id: 'project', name: 'Project', account: 'account' },
        apps: ['salesforce'],
        iss: 'issuer',
        aud: 'audience',
        exp: 9999999999,
        ...overrides,
    };
}

describe('installation authorization compatibility', () => {
    it('limits legacy app grants to default installations', () => {
        expect(hasAppInstallationAccess(token(), installation)).toBe(false);
        expect(hasAppInstallationAccess(token(), { ...installation, instance_key: 'default' })).toBe(true);
        expect(hasAppInstallationAccess(token(), { ...installation, instance_key: undefined })).toBe(true);
    });
    it('does not expand a specific installation grant to siblings', () => {
        const principal = token({
            apps: [],
            app_installations: { version: 1, project_id: 'project', ids: ['eu-install'] },
        });
        expect(hasAppInstallationAccess(principal, installation)).toBe(true);
        expect(hasAppInstallationAccess(principal, { ...installation, id: 'us-install' })).toBe(false);
        expect(hasAppInstallationAccess(principal, { ...installation, id: 'default', instance_key: 'default' })).toBe(
            false,
        );
    });
    it('retains default app-name grants with an empty installation claim without granting named instances', () => {
        const principal = token({ app_installations: { version: 1, project_id: 'project', ids: [] } });
        expect(hasAppInstallationAccess(principal, { ...installation, instance_key: 'default' })).toBe(true);
        expect(hasAppInstallationAccess(principal, installation)).toBe(false);
    });
    it('requires matching token and grant project contexts', () => {
        const principal = token({ app_installations: { version: 1, project_id: 'other', ids: ['eu-install'] } });
        expect(hasAppInstallationAccess(principal, installation)).toBe(false);
        expect(hasAppInstallationAccess(principal, { ...installation, instance_key: 'default' })).toBe(false);
        expect(hasAppInstallationAccess(token(), { ...installation, project: 'other', instance_key: 'default' })).toBe(
            false,
        );
    });
    it.each(['default', undefined])('keeps a running token valid after default reinstall (%s)', (instanceKey) => {
        const principal = token({
            app_installations: { version: 1, project_id: 'project', ids: ['old-default-id'] },
        });
        const reinstalled = { ...installation, id: 'new-default-id', instance_key: instanceKey };
        expect(hasAppInstallationAccess(principal, reinstalled)).toBe(true);
        // Refresh preserves the starting payload, so access must not depend on reissuing its IDs.
        expect(hasAppInstallationAccess(structuredClone(principal), reinstalled)).toBe(true);
        expect(hasAppInstallationAccess(principal, { ...reinstalled, instance_key: 'eu' })).toBe(false);
        expect(hasAppInstallationAccess({ ...principal, apps: [] }, reinstalled)).toBe(false);
    });
    it('preserves default UI restrictions for exact IDs and app-name fallback', () => {
        const base = { ...installation, id: 'new-default-id', instance_key: 'default' };
        const principal = token({
            ui_restrictions: ['salesforce'],
            app_installations: { version: 1, project_id: 'project', ids: ['old-default-id'] },
        });
        expect(hasAppInstallationAccess(principal, base)).toBe(true);
        expect(hasAppInstallationAccess(principal, base, true)).toBe(false);
        principal.app_installations = {
            version: 1,
            project_id: 'project',
            ids: [base.id],
            ui_restrictions: [base.id],
        };
        principal.ui_restrictions = [];
        expect(hasAppInstallationAccess(principal, base, true)).toBe(false);
    });
    it('separates functional access from UI visibility per installation', () => {
        const principal = token({
            app_installations: {
                version: 1,
                project_id: 'project',
                ids: ['eu-install'],
                ui_restrictions: ['eu-install'],
            },
        });
        expect(hasAppInstallationAccess(principal, installation)).toBe(true);
        expect(hasAppInstallationAccess(principal, installation, true)).toBe(false);
    });
});
