import type { Permission } from '../access-control.js';

/**
 * Pure types & constants for the role system. This file is intentionally
 * `class`-free — it is what stays in `@vertesia/common` when the class
 * hierarchy (`classes.ts`) eventually moves to `studio-utils`. Client SDKs
 * depend ONLY on these types, never on the registry runtime.
 */

/**
 * Kind of object a ContentSet's `resource_props` matches at query time. Used
 * in `AceConditions.scope` (validated at runtime against this list) and as
 * the prefix in JWT `content_security` keys (e.g. `collection:read`).
 *
 * Each scope is owned by exactly one partition. When adding a new partition
 * (e.g. tasks), extend this list with the new scope(s) AND extend `RoleDomain`
 * with the new domain.
 */
export const AbacScopes = ['document', 'collection', 'task'] as const;
export type AbacScope = (typeof AbacScopes)[number];

/**
 * Logical grouping of roles by the service area that owns them. One domain may
 * declare roles applicable to multiple scopes (e.g. the `content` domain owns
 * roles applicable to both `document` and `collection` scopes). The `system`
 * domain owns the built-in foundational roles (currently exposed as
 * `SystemRoles`) — registered first so domain partitions cannot shadow them.
 */
export type RoleDomain = 'system' | 'content' | 'tasks';

/**
 * Wire shape of a role returned by the IAM `/roles` endpoint.
 *
 * Permissions are typed `string[]` because role names span multiple partitions
 * (system, content, future tasks/etc.) and each partition has its own
 * vocabulary. For the tightly-typed system-only view (with `permissions:
 * Permission[]`) use `SystemRoleDefinition` and the `/roles/system` endpoint.
 *
 * NOTE: this interface is intentionally non-generic. The OpenAPI generator
 * doesn't handle TypeScript generics cleanly in array response types and
 * produces a degenerate `RoleDefinitionArray` schema. Keeping the wire shapes
 * concrete avoids that. `SystemRoleDefinition` extends and narrows
 * `permissions` to `Permission[]`.
 */
export interface RoleDefinition {
    name: string;
    permissions: string[];
    domain: RoleDomain;
}

/**
 * Tightly-typed view of a system-domain role: permissions are central
 * `Permission` enum values. Returned by `client.iam.roles.listSystem()` and
 * by the server's `/roles/system` endpoint.
 */
export interface SystemRoleDefinition extends RoleDefinition {
    permissions: Permission[];
}
