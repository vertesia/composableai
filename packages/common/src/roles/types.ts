import type { z } from 'zod';
import type {
    AbacScopeSchema,
    RoleDefinitionSchema,
    RoleDomainSchema,
    SystemRoleDefinitionSchema,
} from '../api-schemas/access-control.js';

/**
 * Pure types & constants for the role system. This file is intentionally
 * `class`-free — it is what stays in `@vertesia/common` when the class
 * hierarchy (`classes.ts`) eventually moves to `studio-utils`. Client SDKs
 * depend ONLY on these types, never on the registry runtime.
 *
 * The wire shapes below are inferred from `../api-schemas/access-control.js`, which is what OpenAPI
 * publishes and AJV compiles. `AbacScopes` and `RoleDomains` are the runtime lists those schemas
 * enumerate; they live in `../access-control-values.js` so the schemas can read them without
 * importing this module back.
 */

export { AbacScopes, RoleDomains } from '../access-control-values.js';

/**
 * Kind of object a ResourceSet's `resource_props` matches at query time. Used
 * in `AceConditions.scope` (validated at runtime against this list) and as
 * the prefix in JWT `content_security` keys (e.g. `collection:read`).
 *
 * Each scope is owned by exactly one partition. When adding a new partition
 * (e.g. tasks), extend `AbacScopes` with the new scope(s) AND extend
 * `RoleDomains` with the new domain.
 */
export type AbacScope = z.infer<typeof AbacScopeSchema>;

/**
 * Logical grouping of roles by the service area that owns them. One domain may
 * declare roles applicable to multiple scopes (e.g. the `content` domain owns
 * roles applicable to both `document` and `collection` scopes). The `system`
 * domain owns the built-in foundational roles (currently exposed as
 * `SystemRoles`) — registered first so domain partitions cannot shadow them.
 */
export type RoleDomain = z.infer<typeof RoleDomainSchema>;

/**
 * Wire shape of a role returned by the IAM `/roles` endpoint.
 *
 * Permissions are typed `string[]` because role names span multiple partitions
 * (system, content, future tasks/etc.) and each partition has its own
 * vocabulary. For the tightly-typed system-only view (with `permissions:
 * Permission[]`) use `SystemRoleDefinition` and the `/roles/system` endpoint.
 */
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

/**
 * Tightly-typed view of a system-domain role: permissions are central
 * `Permission` enum values. Returned by `client.iam.roles.listSystem()` and
 * by the server's `/roles/system` endpoint.
 */
export type SystemRoleDefinition = z.infer<typeof SystemRoleDefinitionSchema>;
