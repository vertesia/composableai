import { z } from 'zod';

/**
 * Runtime API schemas for the IAM user endpoints — the second bulk batch.
 *
 * Unlike the quota batch, this one crosses a persistence boundary: `User` is served from a Mongoose
 * document, so the published schema and the stored document are genuinely different shapes and the
 * server maps between them explicitly. What is declared here is the WIRE contract only.
 *
 * `DeleteByIdResult` is the first component shared beyond its own batch — eight studio slots publish
 * it, and all eight had to convert at once. See the note on {@link DeleteByIdResultSchema} for why a
 * shared component cannot move one slot at a time.
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
        // `format: 'date-time'` and not a bare string: the description claims ISO 8601, and AJV
        // (with ajv-formats) enforces the claim rather than leaving it as documentation. Matches
        // how Account publishes its timestamps.
        created_at: z.string().meta({ format: 'date-time', description: 'ISO 8601 creation timestamp.' }),
        updated_at: z.string().meta({ format: 'date-time', description: 'ISO 8601 timestamp of the last update.' }),
    })
    .meta({ id: 'User' });

/**
 * The account members listing, published as its own component because the document already carries
 * `UserArray` — an array named at the top level rather than inlined at the use site.
 *
 * It exists in this batch because `User` became canonical: a legacy array slot whose items `$ref` a
 * canonical component publishes the new contract without enforcing it, so a member document missing
 * timestamps or carrying a null would violate the nested contract silently. Converting the array is
 * what closes that gap.
 */
export const UserArraySchema = z.array(UserSchema).meta({ id: 'UserArray' });

/**
 * The compact user shape embedded in other resources' responses — currently the group members
 * listing, which populates a user document down to these four fields.
 *
 * A `.pick()` of {@link UserSchema}, not a parallel object: `UserRef` IS a projection of `User`, so
 * the field definitions, their requiredness and any constraints come from one declaration. A hand
 * written copy would be a twin that drifts the first time a field on `User` changes. `.pick()` does
 * not carry the `id: 'User'` metadata across, so this still publishes as its own component rather
 * than a second `$ref` to `User`.
 *
 * `email` is therefore required here for the same reason it is on `User`, even though the Mongoose
 * model marks it optional. That is not an oversight to fix by loosening the schema: the component
 * has always said required, and the server maps a missing email to `''` rather than publishing a
 * response that violates it.
 *
 * Note this is the WIRE projection. `UserRefPopulate` is the Mongoose one that feeds it, and stays
 * written out: it names database fields and carries persistence concerns this schema has no view of.
 */
export const UserRefSchema = UserSchema.pick({
    id: true,
    name: true,
    email: true,
    picture: true,
}).meta({ id: 'UserRef' });

export const UserRefArraySchema = z.array(UserRefSchema).meta({ id: 'UserRefArray' });

/**
 * The writable subset of a user, picked from {@link UserSchema} rather than restated.
 *
 * Every field here means exactly what it means on `User` — same type, same constraints — so it comes
 * from one declaration; `.partial()` then relaxes requiredness, which is the only thing a PUT payload
 * genuinely changes about them. The fields NOT picked are the point of the whitelist: `email`,
 * `externalId`, `sign_in_provider`, `source`, `annotations` and the timestamps are set by the
 * identity provider or the server, and a picked schema makes that list impossible to widen by
 * accident.
 *
 * Picking also carries the field descriptions across, so `properties`, `clearance` and `compartments`
 * are now documented on the payload as they always were on `User`. That is additive documentation,
 * not a contract change — the constraints are byte-identical. Use `.pick()` only where the request
 * semantics really do match the response: a field that accepts `null` to clear a value, coerces, or
 * carries a request-only constraint has to be overridden explicitly instead.
 */
export const UpdateUserPayloadSchema = UserSchema.pick({
    name: true,
    username: true,
    picture: true,
    language: true,
    phone: true,
    last_selected_account: true,
    properties: true,
    clearance: true,
    compartments: true,
})
    .partial()
    .meta({ id: 'UpdateUserPayload' });

/**
 * Shared by eight studio delete endpoints, and all eight converted together — a shared component
 * cannot be migrated one slot at a time.
 *
 * The byte-identity guard in the generator does not make it safe to leave the others behind: the
 * public `DeleteByIdResult` is now an alias inferred from this schema, so the TypeScript derivation
 * the other slots relied on changes the moment this one does, and the generator refuses to publish
 * a canonical and a derived component under a single name. Any future shared type has to move as a
 * unit for the same reason.
 */
export const DeleteByIdResultSchema = z.object({ id: z.string() }).meta({ id: 'DeleteByIdResult' });

/**
 * The signup request contract, shared between the sign-in UI and `POST /auth/signup`.
 *
 * `accountType` and `maturity` stay `z.string()`. The UI sends `personal | company` for the first and
 * a maturity catalog of its own for the second, and neither is drawn from the persisted `AccountType`
 * enum — so narrowing them here would not be recording what the endpoint accepts, it would be
 * changing it, and that is a deliberate contract change rather than part of a conversion.
 *
 * `companySize` is a number: the form sends a headcount, not a bucket label.
 */
export const SignupDataSchema = z
    .strictObject({
        accountType: z.string(),
        companyName: z.string().optional(),
        companySize: z.number().optional(),
        companyWebsite: z.string().optional(),
        maturity: z.string().optional(),
    })
    .meta({ id: 'SignupData' });

export const SignupPayloadSchema = z
    .strictObject({
        firebaseToken: z.string(),
        signupData: SignupDataSchema,
    })
    .meta({ id: 'SignupPayload' });

/**
 * The public IAM types, inferred rather than written. `../principal-context.ts`, `../user.ts` and
 * `../common.ts` re-export these under their public names.
 */
export type PrincipalContextFromSchema = z.infer<typeof PrincipalContextSchema>;
export type PrincipalIdentityFromSchema = z.infer<typeof PrincipalIdentitySchema>;
export type UserFromSchema = z.infer<typeof UserSchema>;
export type UserArrayFromSchema = z.infer<typeof UserArraySchema>;
export type UserRefFromSchema = z.infer<typeof UserRefSchema>;
export type UserRefArrayFromSchema = z.infer<typeof UserRefArraySchema>;
export type UpdateUserPayloadFromSchema = z.infer<typeof UpdateUserPayloadSchema>;
export type DeleteByIdResultFromSchema = z.infer<typeof DeleteByIdResultSchema>;
