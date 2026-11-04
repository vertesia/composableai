import {
    type AbacScope,
    CUSTOM_ROLE_PREFIX,
    type CustomRoleDefinition,
    isCustomRoleName,
    type RoleDomain,
} from '@vertesia/common';
import { agentRunPartition } from './agent-runs.js';
import { AbacRole, type Role, type RolePartition, SystemRole } from './classes.js';
import { contentPartition } from './content.js';
import { systemPartition } from './system.js';

export { AgentRunRoleNames } from './agent-runs.js';
export { AbacRole, Role, type RolePartition, SystemRole } from './classes.js';
export { ContentRoleNames } from './content.js';

export type RoleResolver = (name: string) => Role;

export class InvalidCustomRoleError extends Error {}

/**
 * Resolve inheritance once per account snapshot, never in the global registry. By default an
 * invalid custom role grants nothing, including its explicit permissions. Administration and
 * assignment validation use strict mode to reject missing bases and cycles instead.
 */
export function createAccountRoleResolver(
    definitions: readonly CustomRoleDefinition[],
    { strict = false }: { strict?: boolean } = {},
): RoleResolver {
    const definitionsByName = new Map(
        definitions.map((definition) => [CUSTOM_ROLE_PREFIX + definition.name, definition]),
    );
    const resolved = new Map<string, SystemRole>();
    const visiting = new Set<string>();
    const invalid = new Map<string, InvalidCustomRoleError>();
    const resolve = (name: string): SystemRole => {
        const cached = resolved.get(name);
        if (cached) return cached;
        const error = invalid.get(name);
        if (error) throw error;
        if (!isCustomRoleName(name)) {
            const role = listSystemRoles().find((role) => role.name === name);
            if (!role)
                throw new InvalidCustomRoleError(
                    `Invalid base role: ${name}. Only system and custom roles are allowed.`,
                );
            return role;
        }
        const definition = definitionsByName.get(name);
        if (!definition) throw new InvalidCustomRoleError(`Unknown role: ${name}`);
        if (visiting.has(name))
            throw new InvalidCustomRoleError(`Circular role inheritance: ${[...visiting, name].join(' -> ')}`);
        visiting.add(name);
        try {
            const role = new SystemRole(name, definition.permissions);
            for (const base of definition.base_roles ?? []) {
                for (const permission of resolve(base).permissions) role.permissions.add(permission);
            }
            resolved.set(name, role);
            return role;
        } catch (error) {
            if (error instanceof InvalidCustomRoleError) invalid.set(name, error);
            throw error;
        } finally {
            visiting.delete(name);
        }
    };
    return (name) => {
        if (!isCustomRoleName(name)) return getRoleByName(name);
        try {
            return resolve(name);
        } catch (error) {
            if (strict || !(error instanceof InvalidCustomRoleError)) throw error;
            return new SystemRole(name, []);
        }
    };
}

/**
 * The ordered partition registry. Partitions are queried in this order — first
 * match wins. The `system` partition is registered first so domain-specific
 * partitions (added later) cannot shadow built-in system roles.
 */
const partitions: RolePartition[] = [systemPartition, contentPartition, agentRunPartition];

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
 * ABAC roles applicable to a given ResourceSet scope (e.g. `'document'`,
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
 * `abac` pathway instead.
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
 * Return the platform `Permission` keys a caller must hold to delegate a role.
 *
 * System roles already contain complete `domain:verb` Permission values. ABAC roles store bare
 * scope verbs (`read`, `control`, ...) for token generation, which are not Permission values, so
 * they declare the Permissions that gate their delegation separately (`AbacRole.delegationPermissions`).
 */
export function getDelegablePermissionsForRole(roleName: string): string[] {
    const role = getRoleByName(roleName);
    if (role instanceof AbacRole) {
        return [...role.delegationPermissions];
    }
    return [...role.permissions];
}

/**
 * A list of roles with a unified `hasPermission` check across them.
 */
export class RoleList {
    private constructor(public readonly roles: Role[]) {}

    static fromRoleNames(roleNames: string[], resolve: RoleResolver = getRoleByName): RoleList {
        const roles = roleNames.map(resolve);
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
