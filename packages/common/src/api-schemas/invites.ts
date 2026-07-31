import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { TransientTokenType } from '../transient-tokens-values.js';
import { AccountSchema } from './account.js';
import { ProjectRefSchema, SystemRolesSchema } from './apikey.js';
import { UserRefSchema } from './user.js';

/**
 * Runtime API schemas for the account invite, onboarding and project-listing endpoints — the account
 * half of the fifth bulk batch.
 *
 * This batch contains the migration's first outright WRONG published component rather than a merely
 * incomplete one. `TransientToken_UserInviteTokenData_Array` is what the scanner made of
 * `TransientToken<UserInviteTokenData>[]`: it dropped the generic parameter, so the component
 * declares neither `type` nor `data` — the entire invite payload — and it describes a single object
 * although all three endpoints return an array. The endpoints have always sent the full populated
 * documents, so every one of those responses violated its own schema. Publishing the real shape is
 * the fix, and it is a breaking change for generated clients precisely because the old one was
 * unusable.
 */

export const TransientTokenTypeSchema = z.enum(TransientTokenType).meta({ id: 'TransientTokenType' });

/**
 * The compact account shape embedded in other resources' responses.
 *
 * Picked from {@link AccountSchema} rather than restated, for the reason `UserRef` is picked from
 * `User`: two declarations of one projection can only drift. `.pick()` keeps the parent's property
 * order and drops its `meta.id`, so this still publishes as its own component rather than a `$ref`,
 * and the emitted JSON stays byte-identical to what the scanner derives — which it must, because
 * `Interaction` and `PromptTemplate` still reference `AccountRef` and have not converted.
 *
 * `AccountRefPopulate` is the Mongoose projection that produces it; the two are meant to stay in
 * step.
 */
export const AccountRefSchema = AccountSchema.pick({
    id: true,
    name: true,
}).meta({ id: 'AccountRef' });

/**
 * The invite payload. Every reference is populated by the handlers before the response is built —
 * `data.account`, `data.project` and `data.invited_by` all go through `.populate()` — which is why
 * they are object refs here and ObjectIds in Mongo.
 */
export const UserInviteTokenDataSchema = z
    .object({
        email: z.string(),
        role: SystemRolesSchema,
        account: AccountRefSchema,
        project: ProjectRefSchema.optional(),
        invited_by: UserRefSchema,
    })
    .meta({ id: 'UserInviteTokenData' });

/**
 * The invite token as it crosses the wire.
 *
 * Named for the generic instantiation the document already publishes, so the component name does not
 * change under consumers even though its content finally becomes correct. `expires` is required here
 * because every invite is created with a 30-day expiry; the model leaves it optional, and the mapper
 * is what reconciles the two.
 */
export const UserInviteTokenSchema = z
    .object({
        id: z.string(),
        type: TransientTokenTypeSchema,
        data: UserInviteTokenDataSchema,
        expires: z.string().meta({ format: 'date-time' }),
        account: z.string().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'TransientToken_UserInviteTokenData_' });

export const UserInviteTokenArraySchema = z
    .array(UserInviteTokenSchema)
    .meta({ id: 'TransientToken_UserInviteTokenData_Array' });

/**
 * What `POST /account/invites` accepts: the two fields of the invite payload the caller supplies.
 *
 * Picked from {@link UserInviteTokenDataSchema}, which is the resource this request writes — the
 * remaining three (`account`, `project`, `invited_by`) are server-owned, and leaving them out of the
 * pick is what makes that an explicit list rather than an emergent property of two files agreeing.
 */
export const InviteUserRequestPayloadSchema = UserInviteTokenDataSchema.pick({
    email: true,
    role: true,
}).meta({ id: 'InviteUserRequestPayload' });

/**
 * `invited` and `added` are both reachable, though only `invited` is returned today: the handler
 * always creates a token. The literal set is what the published component declares and is kept.
 */
export const InviteUserResponsePayloadSchema = z
    .object({
        action: z.enum(['invited', 'added']),
    })
    .meta({ id: 'InviteUserResponsePayload' });

export const InviteAcceptanceResponseSchema = z
    .object({
        status: z.literal('added'),
    })
    .meta({ id: 'InviteAcceptanceResponse' });

export const InviteDeclineResponseSchema = z
    .object({
        status: z.literal('deleted'),
    })
    .meta({ id: 'InviteDeclineResponse' });

export const OnboardingProgressSchema = z
    .object({
        interactions: z.boolean(),
        prompts: z.boolean(),
        environments: z.boolean(),
        default_environment_defined: z.boolean(),
    })
    .meta({ id: 'OnboardingProgress' });

/** An envelope rather than a bare array, which is what the document already publishes. */
export const AccountProjectsResponseSchema = z
    .object({
        data: z.array(ProjectRefSchema),
    })
    .meta({ id: 'AccountProjectsResponse' });

export type AccountRefFromSchema = z.infer<typeof AccountRefSchema>;
export type UserInviteTokenDataFromSchema = z.infer<typeof UserInviteTokenDataSchema>;
export type UserInviteTokenFromSchema = z.infer<typeof UserInviteTokenSchema>;
export type UserInviteTokenArrayFromSchema = z.infer<typeof UserInviteTokenArraySchema>;
export type InviteUserRequestPayloadFromSchema = z.infer<typeof InviteUserRequestPayloadSchema>;
export type InviteUserResponsePayloadFromSchema = z.infer<typeof InviteUserResponsePayloadSchema>;
export type InviteAcceptanceResponseFromSchema = z.infer<typeof InviteAcceptanceResponseSchema>;
export type InviteDeclineResponseFromSchema = z.infer<typeof InviteDeclineResponseSchema>;
export type OnboardingProgressFromSchema = z.infer<typeof OnboardingProgressSchema>;
export type AccountProjectsResponseFromSchema = z.infer<typeof AccountProjectsResponseSchema>;
