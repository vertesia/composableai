import type { AbacScope, Permission, RoleDomain } from '@vertesia/common';

/**
 * Class hierarchy and registry-bound interface for the role system. These
 * are LOGIC — they have runtime behavior (constructors, instance methods,
 * subclass dispatch via `instanceof`). They live in `@vertesia/studio-utils`
 * (not common) per the package-layering contract: only types stay in common.
 */

/**
 * A role: a named bundle of permissions that ACEs reference by name.
 *
 * Generic over the permission type so subclasses can tighten it:
 *  - **System roles** declare `extends Role<Permission>` — construction time
 *    type-checks against the central `Permission` enum.
 *  - **ABAC roles** (`AbacRole`) declare `extends Role<string>` — permissions
 *    are bare verbs (`'read'`, `'write'`, `'delete'`, future domain-specific
 *    verbs) consumed by the JWT generator to form `{scope}:{verb}` keys in
 *    `content_security`.
 *
 * The registry stores `Role` (defaulting to `Role<string>`) — the loose type
 * is the lowest common denominator. Tight typing is only enforced at
 * declaration sites of the role subclasses.
 */
export class Role<PermissionType extends string = string> {
    permissions: Set<PermissionType>;
    constructor(
        public name: string,
        permissions: PermissionType[],
        public domain: RoleDomain,
    ) {
        this.permissions = new Set(permissions);
    }

    hasPermission(permission: PermissionType) {
        return this.permissions.has(permission);
    }
}

/**
 * Base class for built-in system roles. Hardcodes `domain: 'system'` and
 * specializes `Role<Permission>` so subclasses get compile-time type-checking
 * against the central `Permission` enum at construction.
 */
export class SystemRole extends Role<Permission> {
    constructor(name: string, permissions: Permission[]) {
        super(name, permissions, 'system');
    }
}

/**
 * A role usable in ContentSet ACEs. Adds `applicableScopes` — the kinds of
 * objects the role can be applied to at the ABAC scope level. Inherits
 * `Role<string>` because ABAC verbs aren't constrained to the central
 * `Permission` enum.
 *
 * The IAM UI filters via `listAbacRolesForScope` which checks `instanceof AbacRole`.
 */
export class AbacRole extends Role<string> {
    constructor(
        name: string,
        permissions: string[],
        domain: RoleDomain,
        public applicableScopes: readonly AbacScope[],
    ) {
        super(name, permissions, domain);
    }
}

/**
 * A logical bucket of roles owned by a single domain. The registry iterates
 * partitions in registration order — first match wins. The `system` partition
 * is registered first so domain partitions cannot shadow built-in system roles.
 */
export interface RolePartition {
    domain: RoleDomain;
    roles: Map<string, Role>;
}
