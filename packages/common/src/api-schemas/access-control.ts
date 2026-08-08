import { z } from 'zod';
// From the values module, never from `../access-control.js` or `../roles/types.js`: both derive
// their public types from the schemas below, so importing them here would invert the dependency.
import {
    AbacScopes,
    AccessControlPrincipalType,
    AccessControlResourceType,
    Permission,
    RoleDomains,
} from '../access-control-values.js';

/**
 * Runtime API schemas for IAM roles and access-control entries.
 */

/**
 * The permission vocabulary, hoisted so `SystemRoleDefinition` publishes one reusable enum rather
 * than an inline copy per property.
 */
export const PermissionSchema = z.enum(Permission).meta({ id: 'Permission' });

export const AccessControlResourceTypeSchema = z.enum(AccessControlResourceType).meta({
    id: 'AccessControlResourceType',
});

export const AccessControlPrincipalTypeSchema = z.enum(AccessControlPrincipalType).meta({
    id: 'AccessControlPrincipalType',
});

export const AbacScopeSchema = z.enum(AbacScopes).meta({ id: 'AbacScope' });

export const RoleDomainSchema = z.enum(RoleDomains).meta({
    id: 'RoleDomain',
    description:
        'Logical grouping of roles by the service area that owns them. One domain may declare roles ' +
        'applicable to multiple scopes (e.g. the `content` domain owns roles applicable to both `document` ' +
        'and `collection` scopes, while `agent_runs` owns the `agent_run` scope). The `system` domain owns the built-in foundational roles (currently ' +
        'exposed as `SystemRoles`) — registered first so domain partitions cannot shadow them.',
});

/**
 * Deliberately unconstrained, and hoisted so the constraint's ABSENCE is stated in one place. A
 * condition value is compared by the token and content-security evaluators, which accept literals,
 * operator objects (`{ $gte: 5 }`) and `$principal.` cross-references — a union no schema could
 * usefully close without freezing that vocabulary into the public contract.
 */
export const PropertyConditionValueSchema = z.unknown().meta({
    id: 'PropertyConditionValue',
    description: 'A single condition value. Resolved and evaluated dynamically by token/content security code.',
});

export const PropertyConditionsSchema = z
    .record(z.string(), PropertyConditionValueSchema)
    .meta({ id: 'PropertyConditions' });

/**
 * Closed, and that matters here: the SERVER stores two more fields inside `conditions` —
 * `principal_name` and `resource_name` — which this component has never declared. They are display
 * names held there until `principal`/`resource` migrate from ObjectId to string, and the handlers
 * copy them back into `principal`/`resource` on the way out. Every response that also serialized the
 * raw sub-document was therefore violating its own schema; the mappers now build `conditions`
 * explicitly, so the value still reaches the client — in the field the contract declares.
 */
export const AceConditionsSchema = z
    .object({
        principal_props: PropertyConditionsSchema.meta({
            description: 'Property conditions matched against user/group properties at token time (PrincipalSet).',
        }).optional(),
        resource_props: PropertyConditionsSchema.meta({
            description: 'Property conditions matched against object properties at query time (ResourceSet).',
        }).optional(),
        scope: AbacScopeSchema.meta({
            description:
                "Kind of object the `resource_props` matches. Used to disambiguate which partition's roles " +
                'apply (e.g. content roles vs agent-run roles) and to form the JWT `content_security` key prefix ' +
                "(`{scope}:{verb}`). Absent → `'document'` (default; emits bare `read`/`write`/`delete` keys " +
                'for backward compatibility).',
        }).optional(),
    })
    .meta({
        id: 'AceConditions',
        description:
            'Conditions attached to an ACE for dynamic matching.\n' +
            '- `principal_props`: matched against user/group properties at token time (PrincipalSet).\n' +
            '- `resource_props`: matched against object properties at query time (ResourceSet).',
    });

/**
 * The access control entry as it crosses the wire.
 *
 * `resource` and `principal` are strings here and ObjectIds in Mongo — except for the dynamic
 * (`principal_set` / `content_set`) entries, where the stored ObjectId is meaningless and the handler
 * substitutes the display name out of `conditions`. That substitution is the reason these endpoints
 * need a mapper rather than a serialized document: no cast can express "this field is a different
 * value depending on another field".
 *
 * The timestamps are plain strings rather than `format: date-time`, which is what the document
 * already publishes. Unlike `User` and `UserGroup` this is NOT safe to tighten in passing: `expires_at`
 * shares the declaration and is written from an unvalidated payload, so an existing caller could have
 * stored a value AJV would now reject.
 */
export const AccessControlEntrySchema = z
    .object({
        role: z.string().meta({
            description:
                'Role name. Typed as `string` because role names now span multiple partitions: `SystemRoles` ' +
                "enum values for system-domain roles, and bare strings for ABAC-domain roles (e.g. `'content:reader'`, " +
                "`'content:writer'`, `'content:manager'`, `'agent_runs:reader'`). Mongoose schema validates the value against the " +
                'registered role catalog via `getAllRoleNames()`.',
        }),
        resource_type: AccessControlResourceTypeSchema,
        resource: z.string(),
        principal_type: AccessControlPrincipalTypeSchema,
        principal: z.string(),
        account: z
            .string()
            .meta({ description: 'Account scope — required for principal_set/content_set ACEs.' })
            .optional(),
        project: z
            .string()
            .meta({ description: 'Project scope — narrows a principal_set/content_set ACE to a single project.' })
            .optional(),
        conditions: AceConditionsSchema.meta({
            description: 'Dynamic matching conditions for principal_set/content_set ACEs.',
        }).optional(),
        tags: z.array(z.string()).optional(),
        expires_at: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        id: z.string(),
    })
    .meta({ id: 'AccessControlEntry' });

export const AccessControlEntryArraySchema = z.array(AccessControlEntrySchema).meta({ id: 'AccessControlEntryArray' });

/**
 * Create and update payloads, picked from the entry rather than restated.
 *
 * `ACECreatePayload extends Omit<AccessControlEntry, 'created_at' | 'updated_at' | 'id'>` is what the
 * hand-written types said, so `.omit()` is the literal translation — and the right operator here for
 * the reason the guidance gives: the derived shape is almost everything. `ACEUpdatePayload` was
 * `Partial<ACECreatePayload>`, which `.partial()` reproduces exactly.
 */
export const ACECreatePayloadSchema = AccessControlEntrySchema.omit({
    created_at: true,
    updated_at: true,
    id: true,
}).meta({ id: 'ACECreatePayload' });

export const ACEUpdatePayloadSchema = ACECreatePayloadSchema.partial().meta({ id: 'ACEUpdatePayload' });

/**
 * The role catalog. Both shapes are static — computed from the in-process role registry, never read
 * from Mongo — so these two slots carry no persistence boundary at all.
 */
export const RoleDefinitionSchema = z
    .object({
        name: z.string(),
        permissions: z.array(z.string()),
        domain: RoleDomainSchema,
    })
    .meta({
        id: 'RoleDefinition',
        description:
            'Wire shape of a role returned by the IAM `/roles` endpoint.\n\n' +
            'Permissions are typed `string[]` because role names span multiple partitions (system, content, ' +
            'future tasks/etc.) and each partition has its own vocabulary. For the tightly-typed system-only ' +
            'view (with `permissions: Permission[]`) use `SystemRoleDefinition` and the `/roles/system` endpoint.\n\n' +
            "NOTE: this interface is intentionally non-generic. The OpenAPI generator doesn't handle TypeScript " +
            'generics cleanly in array response types and produces a degenerate `RoleDefinitionArray` schema. ' +
            'Keeping the wire shapes concrete avoids that. `SystemRoleDefinition` extends and narrows ' +
            '`permissions` to `Permission[]`.',
    });

export const RoleDefinitionArraySchema = z.array(RoleDefinitionSchema).meta({ id: 'RoleDefinitionArray' });

/**
 * `.extend()` and not a second object: `SystemRoleDefinition extends RoleDefinition` narrowing
 * `permissions`, expressed as the override it is. Overriding a property keeps its position, so the
 * published property order is unchanged.
 */
export const SystemRoleDefinitionSchema = RoleDefinitionSchema.extend({
    permissions: z.array(PermissionSchema),
}).meta({
    id: 'SystemRoleDefinition',
    description:
        'Tightly-typed view of a system-domain role: permissions are central `Permission` enum values. ' +
        "Returned by `client.iam.roles.listSystem()` and by the server's `/roles/system` endpoint.",
});

export const SystemRoleDefinitionArraySchema = z
    .array(SystemRoleDefinitionSchema)
    .meta({ id: 'SystemRoleDefinitionArray' });

/**
 * The public access-control types, inferred rather than written. `../access-control.ts` and
 * `../roles/types.ts` re-export these under their public names.
 */
export type PropertyConditionsFromSchema = z.infer<typeof PropertyConditionsSchema>;
export type AceConditionsFromSchema = z.infer<typeof AceConditionsSchema>;
export type AccessControlEntryFromSchema = z.infer<typeof AccessControlEntrySchema>;
export type AccessControlEntryArrayFromSchema = z.infer<typeof AccessControlEntryArraySchema>;
export type ACECreatePayloadFromSchema = z.infer<typeof ACECreatePayloadSchema>;
export type ACEUpdatePayloadFromSchema = z.infer<typeof ACEUpdatePayloadSchema>;
export type RoleDefinitionFromSchema = z.infer<typeof RoleDefinitionSchema>;
export type RoleDefinitionArrayFromSchema = z.infer<typeof RoleDefinitionArraySchema>;
export type SystemRoleDefinitionFromSchema = z.infer<typeof SystemRoleDefinitionSchema>;
export type SystemRoleDefinitionArrayFromSchema = z.infer<typeof SystemRoleDefinitionArraySchema>;
