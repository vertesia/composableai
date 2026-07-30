import { z } from 'zod';

/**
 * Runtime API schemas for the IAM user endpoints — the second bulk batch.
 *
 * Unlike the quota batch, this one crosses a persistence boundary: `User` is served from a Mongoose
 * document, so the published schema and the stored document are genuinely different shapes and the
 * server maps between them explicitly. What is declared here is the WIRE contract only.
 *
 * `DeleteByIdResult` is the first component shared beyond its own batch — eight studio slots publish
 * it. The generator requires a canonical component and a same-named derived one to be byte-identical,
 * so converting it republishes the identical definition for all eight while the other seven slots
 * migrate later on their own schedule.
 */

/**
 * Not hoisted: no `id` in `.meta()`, so the adapter inlines it into `PrincipalIdentity` instead of
 * emitting a `PrincipalContext` component and a `$ref` the document has never published.
 *
 * It still exists as a schema rather than being spelled out inside `PrincipalIdentitySchema`,
 * because `PrincipalContext` is a public type in its own right — consumed by PrincipalSet condition
 * evaluation and client-side ABAC tooling. Composing the two is what keeps the five inherited fields
 * from becoming a hand-written twin of the schema that publishes them.
 */
export const PrincipalContextSchema = z.object({
    clearance: z.number(),
    compartments: z.array(z.string()),
    email: z.string().optional(),
    tags: z.array(z.string()),
    properties: z.record(z.string(), z.unknown()),
});

/**
 * `.extend()` rather than a fresh object literal: it appends `id` after the inherited five, which is
 * both what `interface PrincipalIdentity extends PrincipalContext` produced and the property order
 * the document already publishes.
 */
export const PrincipalIdentitySchema = PrincipalContextSchema.extend({
    id: z.string(),
}).meta({
    id: 'PrincipalIdentity',
    description:
        "Response shape of the `/iam/users/identity` endpoint: the current principal's  {@link  " +
        'PrincipalContext }  plus its id. Distinct from `PrincipalContext` itself because the id is ' +
        'identity metadata, not a merged BLP field — adding it to `PrincipalContext` would ' +
        'unintentionally expose `$principal.id` to PrincipalSet rule evaluation.',
});

/**
 * The user as it crosses the wire.
 *
 * `created_at` and `updated_at` are DECLARED here but were absent from the published component,
 * while the endpoint has always shipped them: the Mongoose model sets `timestamps`, and the handler
 * serialized the whole document. The published `User` was closed, so every response the endpoint
 * has ever sent violated its own schema. Declaring the two fields corrects the document to describe
 * what actually ships; removing them from the response instead would have been a silent breaking
 * change for anyone already reading them.
 */
export const UserSchema = z
    .object({
        id: z.string(),
        externalId: z.string().optional(),
        email: z.string(),
        name: z.string(),
        username: z.string().optional(),
        picture: z.string().optional(),
        language: z.string().optional(),
        phone: z.string().optional(),
        sign_in_provider: z.string().optional(),
        last_selected_account: z.string().optional(),
        source: z.enum(['firebase', 'scim']).optional(),
        updated_by: z.string().optional(),
        properties: z
            .record(z.string(), z.unknown())
            .optional()
            .meta({ description: 'Custom properties for dynamic permission matching' }),
        clearance: z.number().optional().meta({
            description: 'BLP clearance level — determines max document sensitivity the user can access',
        }),
        compartments: z.array(z.string()).optional().meta({
            description: 'Compartments the user belongs to — restricts access to documents in matching compartments',
        }),
        annotations: z
            .array(z.string())
            .optional()
            .meta({ description: 'Free-form user metadata - restricted to internal use' }),
        created_at: z.string().meta({ description: 'ISO 8601 creation timestamp.' }),
        updated_at: z.string().meta({ description: 'ISO 8601 timestamp of the last update.' }),
    })
    .meta({ id: 'User' });

export const UpdateUserPayloadSchema = z
    .object({
        name: z.string().optional(),
        username: z.string().optional(),
        picture: z.string().optional(),
        language: z.string().optional(),
        phone: z.string().optional(),
        last_selected_account: z.string().optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
        clearance: z.number().optional(),
        compartments: z.array(z.string()).optional(),
    })
    .meta({ id: 'UpdateUserPayload' });

/**
 * Shared by eight studio delete endpoints, of which only `DeleteUser` is converted in this batch.
 * The other seven keep deriving it from the TypeScript interface, and the generator fails the build
 * if the two definitions ever differ — which is what makes converting a shared component safe to do
 * one slot at a time.
 */
export const DeleteByIdResultSchema = z.object({ id: z.string() }).meta({ id: 'DeleteByIdResult' });

/**
 * The public IAM types, inferred rather than written. `../principal-context.ts`, `../user.ts` and
 * `../common.ts` re-export these under their public names.
 */
export type PrincipalContextFromSchema = z.infer<typeof PrincipalContextSchema>;
export type PrincipalIdentityFromSchema = z.infer<typeof PrincipalIdentitySchema>;
export type UserFromSchema = z.infer<typeof UserSchema>;
export type UpdateUserPayloadFromSchema = z.infer<typeof UpdateUserPayloadSchema>;
export type DeleteByIdResultFromSchema = z.infer<typeof DeleteByIdResultSchema>;
