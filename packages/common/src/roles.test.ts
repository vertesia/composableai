import { describe, expect, test } from 'vitest';
import { Permission } from './access-control.js';
import { ProjectRoles } from './project.js';
import { getPermissionsForRoles, getRoleByName, listRoles } from './roles.js';

describe('role permission catalog', () => {
    test('lists all project roles', () => {
        expect(
            listRoles()
                .map((role) => role.name)
                .sort(),
        ).toEqual(Object.values(ProjectRoles).sort());
    });

    test('derives developer permissions without administrative grants', () => {
        const developer = getRoleByName(ProjectRoles.developer);

        expect(developer.hasPermission(Permission.int_read)).toBe(true);
        expect(developer.hasPermission(Permission.account_admin)).toBe(false);
        expect(developer.hasPermission(Permission.project_admin)).toBe(false);
    });

    test('deduplicates permissions across multiple roles', () => {
        const permissions = getPermissionsForRoles([ProjectRoles.reader, ProjectRoles.executor]);

        expect(permissions).toContain(Permission.account_member);
        expect(permissions).toContain(Permission.content_read);
        expect(permissions.filter((permission) => permission === Permission.account_member)).toHaveLength(1);
    });
});
