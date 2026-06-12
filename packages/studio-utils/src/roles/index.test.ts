import { Permission, ProjectRoles } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ContentRoleNames } from './content.js';
import {
    AbacRole,
    getAllRoleNames,
    getPermissionsForRoles,
    getRoleByName,
    listAbacRolesForScope,
    listRoles,
    listRolesByDomain,
    listSystemRoles,
    Role,
    RoleList,
    SystemRole,
} from './index.js';

describe('getRoleByName', () => {
    it('returns a system role by name', () => {
        const role = getRoleByName(ProjectRoles.owner);
        expect(role).toBeInstanceOf(SystemRole);
        expect(role.name).toBe('owner');
        expect(role.domain).toBe('system');
    });

    it('returns an ABAC role by name', () => {
        const role = getRoleByName(ContentRoleNames.content_reader);
        expect(role).toBeInstanceOf(AbacRole);
        expect(role.name).toBe('content_reader');
        expect(role.domain).toBe('content');
    });

    it('throws on unknown role', () => {
        expect(() => getRoleByName('not_a_real_role')).toThrow(/Role not_a_real_role not found/);
    });

    it('queries partitions in registration order — system first', () => {
        // System partition is registered before content. Even if a future partition
        // declared a role named 'owner', the system one would still win.
        const role = getRoleByName(ProjectRoles.owner);
        expect(role.domain).toBe('system');
    });
});

describe('listRoles', () => {
    it('returns every role across all partitions', () => {
        const roles = listRoles();
        // 16 system roles + 3 content roles
        expect(roles).toHaveLength(19);
    });

    it('lists system roles before content roles (partition registration order)', () => {
        const roles = listRoles();
        const systemCount = roles.filter((r) => r.domain === 'system').length;
        const contentCount = roles.filter((r) => r.domain === 'content').length;
        expect(systemCount).toBe(16);
        expect(contentCount).toBe(3);

        // First 16 are system, next 3 are content
        for (let i = 0; i < 16; i++) expect(roles[i].domain).toBe('system');
        for (let i = 16; i < 19; i++) expect(roles[i].domain).toBe('content');
    });
});

describe('listRolesByDomain', () => {
    it('returns only system roles for "system"', () => {
        const roles = listRolesByDomain('system');
        expect(roles).toHaveLength(16);
        expect(roles.every((r) => r.domain === 'system')).toBe(true);
    });

    it('returns only content roles for "content"', () => {
        const roles = listRolesByDomain('content');
        expect(roles).toHaveLength(3);
        expect(roles.every((r) => r.domain === 'content')).toBe(true);
    });

    it('returns empty for an unregistered domain', () => {
        expect(listRolesByDomain('tasks')).toEqual([]);
    });
});

describe('listSystemRoles', () => {
    it('returns SystemRole instances', () => {
        const roles = listSystemRoles();
        expect(roles).toHaveLength(16);
        expect(roles.every((r) => r instanceof SystemRole)).toBe(true);
    });

    it('excludes ABAC roles', () => {
        const roles = listSystemRoles();
        expect(roles.some((r) => r instanceof AbacRole)).toBe(false);
    });
});

describe('listAbacRolesForScope', () => {
    it('returns content roles for "document" scope', () => {
        const roles = listAbacRolesForScope('document');
        expect(roles).toHaveLength(3);
        expect(roles.map((r) => r.name).sort()).toEqual(['content_manager', 'content_reader', 'content_writer']);
    });

    it('returns content roles for "collection" scope (same roles, applicableScopes covers both)', () => {
        const roles = listAbacRolesForScope('collection');
        expect(roles).toHaveLength(3);
        expect(roles.every((r) => r.applicableScopes.includes('collection'))).toBe(true);
    });

    it('returns empty for "task" scope (no task partition registered)', () => {
        expect(listAbacRolesForScope('task')).toEqual([]);
    });

    it('returns AbacRole instances only — no system roles bleed through', () => {
        const roles = listAbacRolesForScope('document');
        expect(roles.every((r) => r instanceof AbacRole)).toBe(true);
    });
});

describe('getAllRoleNames', () => {
    it('returns names of every registered role', () => {
        const names = getAllRoleNames();
        expect(names).toHaveLength(19);
        expect(names).toContain('owner');
        expect(names).toContain('content_reader');
    });

    it('produces a flat list suited for mongoose enum constraints', () => {
        const names = getAllRoleNames();
        expect(names.every((n) => typeof n === 'string')).toBe(true);
    });
});

describe('getPermissionsForRoles', () => {
    it('merges permissions across multiple roles, deduped', () => {
        // content_reader: ['read']
        // content_writer: ['read', 'write']
        const merged = getPermissionsForRoles([ContentRoleNames.content_reader, ContentRoleNames.content_writer]);
        expect(merged.sort()).toEqual(['read', 'write']);
    });

    it('returns system Permission values for system roles', () => {
        const merged = getPermissionsForRoles([ProjectRoles.reader]);
        // reader role has: int_read, run_read, content_read + account_member (via OrgMemberRole)
        expect(merged).toContain(Permission.int_read);
        expect(merged).toContain(Permission.content_read);
        expect(merged).toContain(Permission.account_member);
    });
});

describe('Role instances', () => {
    it('SystemRole hasPermission for granted Permission', () => {
        const owner = getRoleByName(ProjectRoles.owner);
        expect(owner.hasPermission(Permission.content_read)).toBe(true);
        expect(owner.hasPermission(Permission.manage_billing)).toBe(true);
    });

    it('SystemRole hasPermission false for arbitrary string', () => {
        const reader = getRoleByName(ProjectRoles.reader);
        expect(reader.hasPermission('not_a_real_perm')).toBe(false);
    });

    it('AbacRole carries applicableScopes', () => {
        const reader = getRoleByName(ContentRoleNames.content_reader) as AbacRole;
        expect(reader.applicableScopes).toEqual(['document', 'collection']);
    });

    it('AbacRole permissions are bare verbs, not Permission enum values', () => {
        const manager = getRoleByName(ContentRoleNames.content_manager);
        expect(Array.from(manager.permissions).sort()).toEqual(['delete', 'read', 'write']);
    });
});

describe('SystemRole vs AbacRole discrimination', () => {
    it('SystemRole instanceof Role', () => {
        const owner = getRoleByName(ProjectRoles.owner);
        expect(owner).toBeInstanceOf(Role);
        expect(owner).toBeInstanceOf(SystemRole);
        expect(owner).not.toBeInstanceOf(AbacRole);
    });

    it('AbacRole instanceof Role', () => {
        const reader = getRoleByName(ContentRoleNames.content_reader);
        expect(reader).toBeInstanceOf(Role);
        expect(reader).toBeInstanceOf(AbacRole);
        expect(reader).not.toBeInstanceOf(SystemRole);
    });
});

describe('RoleList', () => {
    it('fromRoleNames composes a list checkable for permissions', () => {
        const list = RoleList.fromRoleNames([ProjectRoles.reader, ProjectRoles.executor]);
        expect(list.hasPermission(Permission.content_read)).toBe(true); // from reader
        expect(list.hasPermission(Permission.int_execute)).toBe(true); // from executor
        expect(list.hasPermission(Permission.manage_billing)).toBe(false); // neither has it
    });

    it('fromRoleName composes a single-role list', () => {
        const list = RoleList.fromRoleName(ProjectRoles.billing);
        expect(list.hasPermission(Permission.manage_billing)).toBe(true);
        expect(list.hasPermission(Permission.content_write)).toBe(false);
    });

    it('throws on unknown role name', () => {
        expect(() => RoleList.fromRoleNames(['not_real'])).toThrow(/Role not_real not found/);
    });
});
