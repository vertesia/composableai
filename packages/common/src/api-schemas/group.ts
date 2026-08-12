import { z } from 'zod';

/**
 * Runtime API schemas for the IAM user-group endpoints.
 *
 * These contracts cross a persistence boundary, and the gap between document and wire is
 * wider here. Three things the stored document carries are NOT in this contract and never were:
 * `members` (the model marks it `select: false`, yet two handlers `populate()` it straight back into
 * the response), `_id`, and `__v`. `UserGroup` is published `additionalProperties: false`, so those
 * responses have been violating their own schema; the server now maps the document explicitly
 * instead of serializing it, which is what makes the published contract true.
 *
 * `UserRef` lives in `./user.js` rather than here — it is the shape of a USER, published by the
 * group members listing but not owned by it.
 */

/**
 * The user group as it crosses the wire.
 *
 * `created_at`/`updated_at` are declared `z.string()` while the public TypeScript type used to say
 * `Date`. The document has always published `type: string, format: date-time`, and JSON has no date
 * type, so the old type was wrong about what a client receives — it described the Mongoose document,
 * not the response. Inferring the public type from this schema corrects it.
 */
export const UserGroupSchema = z
    .object({
        id: z.string(),
        account: z.string(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        created_by: z.string().optional(),
        updated_by: z.string().optional(),
        properties: z
            .record(z.string(), z.unknown())
            .optional()
            .meta({ description: 'Custom properties for dynamic permission matching' }),
        clearance: z
            .number()
            .optional()
            .meta({ description: 'BLP clearance level — merged with user clearance using max()' }),
        compartments: z
            .array(z.string())
            .optional()
            .meta({ description: 'Compartments — merged with user compartments using array union' }),
        allowed_projects: z
            .array(z.string())
            .optional()
            .meta({
                description:
                    'Projects this group is allowed to be used in. When empty or absent the group is org-wide ' +
                    '(usable in any project). When set, the group may only be used to grant permissions in the ' +
                    'listed projects.',
            }),
    })
    .meta({ id: 'UserGroup' });

/**
 * The group listing. Converted with `UserGroup` rather than later: its items `$ref` the canonical
 * component, so publishing the array while returning an unmapped document would document the
 * contract for every group and enforce it for none — the gap the account members listing had.
 */
export const UserGroupArraySchema = z.array(UserGroupSchema).meta({ id: 'UserGroupArray' });

export const ListUserGroupsQuerySchema = z
    .object({
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        project: z.string().optional(),
    })
    .meta({ id: 'ListUserGroupsQuery' });

/**
 * Both payloads are picked from {@link UserGroupSchema}, for the same reason `UserRef` is: they are
 * subsets of the group, not parallel shapes. What each `.pick()` leaves out is the whitelist —
 * `id`, `account`, the timestamps and `created_by`/`updated_by` are server-owned — and it can no
 * longer widen silently, because adding a writable field means naming it here.
 *
 * `tags` is the one field whose requiredness genuinely differs: a group always HAS tags (the model
 * defaults to `[]`), but neither payload makes the caller send them.
 */
const UserGroupWritableSchema = UserGroupSchema.pick({
    name: true,
    description: true,
    tags: true,
    allowed_projects: true,
});

/**
 * `allowed_projects` is overridden rather than inherited: on the response it explains what an empty
 * list MEANS, while on a create request it tells the caller what sending one DOES. Same field, and
 * genuinely different documentation — which is the general rule for picking. Anything where the
 * request semantics differ (a `null` that clears a value, a coercion, a request-only bound) has to be
 * overridden the same way instead of inherited.
 */
export const CreateUserGroupPayloadSchema = UserGroupWritableSchema.partial({ tags: true })
    .extend({
        allowed_projects: z
            .array(z.string())
            .optional()
            .meta({ description: 'Restrict the new group to the given projects (empty/absent = org-wide).' }),
    })
    .meta({ id: 'CreateUserGroupPayload' });

/**
 * The update payload writes more than create does — the BLP and dynamic-matching fields are settable
 * only after the group exists — so it picks a wider subset of the same schema.
 *
 * `name` is required, which the published component has always said and both update handlers
 * enforced by hand with a 400. Validation now does it, so the hand-rolled check is redundant rather
 * than load-bearing — it is kept for the same reason the user update whitelist was: removing it is a
 * behaviour change that does not belong in a contract change.
 */
export const UpdateUserGroupPayloadSchema = UserGroupSchema.pick({
    name: true,
    description: true,
    tags: true,
    properties: true,
    clearance: true,
    compartments: true,
    allowed_projects: true,
})
    .partial({ tags: true })
    .meta({ id: 'UpdateUserGroupPayload' });

/**
 * The group as it appears embedded in a token payload, and the one place a group crosses the wire
 * without being the response of a group endpoint.
 *
 * Picked from {@link UserGroupSchema} for the same reason the payloads are — it is a subset of the
 * group, not a parallel shape — and the subset is decided by what an authorization decision needs:
 * identity (`id`, `name`), the dynamic-matching input (`tags`, `properties`) and the BLP inputs
 * (`clearance`, `compartments`, `allowed_projects`). `account` and the audit fields are deliberately
 * out: a token is not a place to restate who edited a group.
 *
 * `tags` is optional here while the group always has them, matching the payloads: the token mapper
 * omits an empty list rather than emitting one.
 *
 * This is NOT the Mongoose projection that feeds it. The projection is a `select()` string that lives
 * beside its query — token-server has one, studio-server's resource-reference endpoint has a
 * different and much narrower one — and a single shared string would have to be the union of every
 * caller's needs, which is how the previous `UserGroupRefPopulate` came to select a `description`
 * that nothing emits.
 */
export const UserGroupRefSchema = UserGroupSchema.pick({
    id: true,
    name: true,
    tags: true,
    properties: true,
    clearance: true,
    compartments: true,
    allowed_projects: true,
})
    .partial({ tags: true })
    .meta({ id: 'UserGroupRef' });

/**
 * The array components have no public alias of their own — `UserGroup[]` is what the client sees —
 * so this exists only for the gate in `./group.contract.test.ts` to assert that equivalence.
 */
export type UserGroupArrayFromSchema = z.infer<typeof UserGroupArraySchema>;
