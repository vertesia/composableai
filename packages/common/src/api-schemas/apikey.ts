import { z } from 'zod';
// From the values modules, never from `../apikey.js` / `../project.js`: both derive their public
// types from the schemas below, so importing them here would invert the dependency.
import { ApiKeyTypes } from '../apikey-values.js';
import { SystemRoles } from '../project-values.js';

/**
 * Runtime API schemas for the API key endpoints — converted as the fifth bulk batch, together with
 * the account invite and onboarding slots.
 *
 * The list query came first, on its own, because it exercises the query-parameter path: the scanner
 * expands an object schema into individual `in: query` parameters rather than referencing it, so a
 * canonical component has to survive that expansion with its enum and optionality intact.
 *
 * `ProjectRef` lives here rather than in a projects module because this batch is what forces it
 * canonical — every API key embeds one, and a canonical component cannot `$ref` a TypeScript-derived
 * one. It is the first component shared with slots in a LATER batch (`ProjectsResource.listProjects`
 * and `AppsResource.getAppInstallationProjects` both publish `ProjectRefArray`), which is safe only
 * because the emitted JSON is byte-identical to what the scanner derives — the generator fails the
 * build otherwise.
 */

export const ApiKeyListQuerySchema = z
    .object({
        /** Restricts the listing to keys scoped at the account or the project level. */
        level: z.enum(['account', 'project']).optional(),
    })
    .meta({ id: 'ApiKeyListQuery' });

export const ApiKeyReadQuerySchema = z
    .object({
        withValue: z.boolean().optional(),
    })
    .meta({ id: 'ApiKeyReadQuery' });

/**
 * `z.literal` rather than `z.enum`, because the enum has exactly one member and the document
 * publishes it as `const: 'sk'`. A one-member `enum: ['sk']` would validate identically and diff —
 * and this component is still derived by slots that have not converted, where the generator requires
 * the two definitions to be byte-identical.
 */
export const ApiKeyTypesSchema = z.literal(ApiKeyTypes.secret).meta({ id: 'ApiKeyTypes' });

export const SystemRolesSchema = z.enum(SystemRoles).meta({ id: 'SystemRoles' });

/**
 * The compact project shape embedded in other resources' responses.
 *
 * Written out rather than picked from a project schema, because there is no project schema yet —
 * `Project` converts in a later batch. When it does, this becomes its `.pick()`, and the byte
 * identity asserted in `apikey.contract.test.ts` is what will catch any drift in the meantime.
 */
export const ProjectRefSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        account: z.string(),
        restricted: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Only set when fetching the list of projects visible to an user which is an org admin or owner. ' +
                    'If present and true, it means that the project is not accessible to the user.(even if it visible ' +
                    'in listing) If not present or false then the project is accessible to the user.',
            }),
    })
    .meta({ id: 'ProjectRef' });

export const ProjectRefArraySchema = z.array(ProjectRefSchema).meta({ id: 'ProjectRefArray' });

/**
 * The API key as it crosses the wire.
 *
 * `created_at`, `updated_at` and `expires_at` are `z.string()` while the public TypeScript type said
 * `Date`. The document has always published `format: date-time`, and JSON has no date type, so the
 * old declaration described the Mongoose document rather than the response — the same correction
 * `UserGroup` needed.
 *
 * Enforcing that format on read is safe here in a way it was not for an ACE, but not for the reason
 * an earlier draft of this comment gave: `expires_at` DOES originate in the caller's create payload.
 * What makes it safe is that it is a `Date` on the Mongoose schema, so a value Mongoose cannot cast
 * is rejected at write time and everything stored is a real date — and the response mapper renders
 * it with `toISOString()` rather than echoing what the caller sent. The ACE's `expires_at` is a
 * plain string all the way down, which is why tightening it there would have turned stored data into
 * a 500 on read.
 *
 * `value` is deliberately absent. A key's secret is published only by the two components that
 * declare it — {@link ApiKeyWithValueSchema} on creation and {@link ApiKeyReadResponseSchema} on an
 * explicit `?withValue=true` read — so a handler cannot leak it by returning the wrong shape.
 */
export const ApiKeySchema = z
    .object({
        id: z.string(),
        name: z.string(),
        type: ApiKeyTypesSchema,
        role: SystemRolesSchema,
        maskedValue: z.string().optional(),
        can_retrieve_value: z.boolean().optional(),
        account: z.string(),
        project: ProjectRefSchema,
        enabled: z.boolean(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        expires_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'ApiKey' });

export const ApiKeyArraySchema = z.array(ApiKeySchema).meta({ id: 'ApiKeyArray' });

/** The creation response: the only time the secret is returned unconditionally. */
export const ApiKeyWithValueSchema = ApiKeySchema.extend({
    value: z.string(),
}).meta({ id: 'ApiKeyWithValue' });

/**
 * The single-key read. `value` is present only when the caller asked for it AND holds
 * `api_key:secret_read`, so it is optional here where creation makes it required — which is exactly
 * why the two cannot share one component.
 */
export const ApiKeyReadResponseSchema = ApiKeySchema.extend({
    value: z.string().optional(),
}).meta({ id: 'ApiKeyReadResponse' });

/**
 * What `POST /apikeys` accepts.
 *
 * Create and update used to share one `CreateOrUpdateApiKeyPayload extends Partial<ApiKey>`, and
 * translating that literally as `ApiKeySchema.partial()` reproduced a payload that could not
 * describe either operation truthfully:
 *
 *  - `role` is `required: true` on the Mongoose schema, so a create that omitted it reached
 *    `ApiKeyModel.create` with `role: undefined` and failed validation inside the handler. Requiring
 *    it here turns a 500 into the 400 it always was.
 *  - `name` is required by the published `ApiKey` component, so a key created without one could not
 *    produce a conforming response.
 *  - It declared every server-owned field — `id`, `account`, `maskedValue`, `can_retrieve_value`,
 *    the timestamps — all of which the handler has always ignored.
 *
 * `.pick()` rather than a fresh object, so the four fields keep one declaration; `.partial()` on the
 * two the server defaults (`type` falls back to `sk`, `expires_at` means "never"). Requiredness is
 * the only thing a write payload legitimately changes about a field it shares.
 */
export const CreateApiKeyPayloadSchema = ApiKeySchema.pick({
    name: true,
    role: true,
    type: true,
    expires_at: true,
})
    .partial({ type: true, expires_at: true })
    .meta({ id: 'CreateApiKeyPayload' });

/**
 * What `PUT /apikeys/:keyId` accepts: the three fields the handler applies, each optional.
 *
 * Narrower than the create payload in both directions — `type` and `expires_at` are immutable after
 * creation, `enabled` is only settable here — which is precisely why one shared component could not
 * be right for both. The handler now applies only the properties actually present; it used to assign
 * `payload.name`, `payload.role` and `payload.enabled` unconditionally, so omitting `role` in a
 * partial update unset a required path and made `save()` throw.
 */
export const UpdateApiKeyPayloadSchema = ApiKeySchema.pick({
    name: true,
    role: true,
    enabled: true,
})
    .partial()
    .meta({ id: 'UpdateApiKeyPayload' });

export const AuthTokenResponseSchema = z.object({ token: z.string() }).meta({ id: 'AuthTokenResponse' });

/**
 * The raw Mongo delete acknowledgement, published as-is — `deletedCount` is `number` rather than
 * `integer` because that is what the derived component said, and this conversion reproduces the
 * contract rather than renegotiating it.
 */
export const DeleteOperationResultSchema = z
    .object({
        acknowledged: z.boolean(),
        deletedCount: z.number(),
    })
    .meta({ id: 'DeleteOperationResult' });

export type ApiKeyListQueryFromSchema = z.infer<typeof ApiKeyListQuerySchema>;
export type ApiKeyReadQueryFromSchema = z.infer<typeof ApiKeyReadQuerySchema>;
export type ProjectRefArrayFromSchema = z.infer<typeof ProjectRefArraySchema>;
export type ApiKeyFromSchema = z.infer<typeof ApiKeySchema>;
export type ApiKeyArrayFromSchema = z.infer<typeof ApiKeyArraySchema>;
export type ApiKeyWithValueFromSchema = z.infer<typeof ApiKeyWithValueSchema>;
export type ApiKeyReadResponseFromSchema = z.infer<typeof ApiKeyReadResponseSchema>;
export type CreateApiKeyPayloadFromSchema = z.infer<typeof CreateApiKeyPayloadSchema>;
export type UpdateApiKeyPayloadFromSchema = z.infer<typeof UpdateApiKeyPayloadSchema>;
export type AuthTokenResponseFromSchema = z.infer<typeof AuthTokenResponseSchema>;
