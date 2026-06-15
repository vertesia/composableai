import type { AbacScope, RoleDomain } from '@vertesia/common';
import { AbacRole, type Role, type RolePartition, SystemRole } from './classes.js';
import { contentPartition } from './content.js';
import { systemPartition } from './system.js';

export { AbacRole, Role, type RolePartition, SystemRole } from './classes.js';
export { ContentRoleNames } from './content.js';

/**
 * The ordered partition registry. Partitions are queried in this order — first
 * match wins. The `system` partition is registered first so domain-specific
 * partitions (added later) cannot shadow built-in system roles.
 */
const partitions: RolePartition[] = [systemPartition, contentPartition];

/** Look up a role by its name across all registered partitions. */
export function getRoleByName(name: string): Role {
    for (const partition of partitions) {
        const role = partition.roles.get(name);
        if (role) return role;
    }
    throw new Error(`Role ${name} not found`);
}

/** List every role across all partitions, in partition registration order. */
export function listRoles(): Role[] {
    const result: Role[] = [];
    for (const partition of partitions) {
        for (const role of partition.roles.values()) {
            result.push(role);
        }
    }
    return result;
}

/** Roles owned by a specific domain (e.g. `'system'`, `'content'`). */
export function listRolesByDomain(domain: RoleDomain): Role[] {
    const partition = partitions.find((p) => p.domain === domain);
    return partition ? Array.from(partition.roles.values()) : [];
}

/**
 * ABAC roles applicable to a given ContentSet scope (e.g. `'document'`,
 * `'collection'`). System roles are excluded — they don't carry scope semantics.
 */
export function listAbacRolesForScope(scope: AbacScope): AbacRole[] {
    return listRoles().filter((r): r is AbacRole => r instanceof AbacRole && r.applicableScopes.includes(scope));
}

/** Shortcut for the system partition: returns only `SystemRole` instances. */
export function listSystemRoles(): SystemRole[] {
    return listRoles().filter((r): r is SystemRole => r instanceof SystemRole);
}

/** Names of every registered role across all partitions — suited for mongoose schema enum constraints. */
export function getAllRoleNames(): string[] {
    return listRoles().map((r) => r.name);
}

/**
 * Merge the permissions granted by a set of roles into a single array.
 * Intended for the system-role gating path. For ABAC roles, the bare-verb
 * permissions returned here aren't directly meaningful — use the JWT
 * `content_security` pathway instead.
 */
export function getPermissionsForRoles(roleNames: Iterable<string>): string[] {
    const permissions = new Set<string>();
    for (const roleName of roleNames) {
        const role = getRoleByName(roleName);
        for (const permission of role.permissions) {
            permissions.add(permission);
        }
    }
    return Array.from(permissions);
}

/**
 * A list of roles with a unified `hasPermission` check across them.
 */
export class RoleList {
    private constructor(public readonly roles: Role[]) {}

    static fromRoleNames(roleNames: string[]): RoleList {
        const roles = roleNames.map((r) => getRoleByName(r));
        return new RoleList(roles);
    }

    static fromRoleName(roleName: string): RoleList {
        const roles = [getRoleByName(roleName)];
        return new RoleList(roles);
    }

    hasPermission(perm: string): boolean {
        return this.roles.some((role) => role.hasPermission(perm));
    }
}
