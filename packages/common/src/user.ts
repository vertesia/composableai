import type * as Wire from './wire-types.generated.js';

export * from './account-values.js';

/**
 * The user and its update payload as they cross the wire.
 *
 * Derived from the schemas in `./api-schemas/user.js`, which are what OpenAPI publishes and AJV
 * compiles. The descriptions live there too — Zod reads `.meta()`, not TSDoc.
 *
 * NOTE for server code: this is the RESPONSE shape, not the stored document. `IUser` in
 * `@dglabs/server-common` describes what Mongo actually holds (optional email, ObjectId
 * references, Date timestamps) and is deliberately independent of this type.
 */
export type User = Wire.User;
export type UpdateUserPayload = Wire.UpdateUserPayload;

/**
 * The compact user shape embedded in other resources' responses, derived from `UserRefSchema`.
 *
 * `UserRefPopulate` is the Mongoose projection that produces it, and the two are meant to stay in
 * step: a field added here without adding it there yields a response missing the field.
 */
export type UserRef = Wire.UserRef;

export const UserRefPopulate = 'id name email picture';

/**
 * Annotation marker (stored in {@link User.annotations}) that grants a user access to
 * non-production environments (`preview`, `preprod`). See
 * `docs/restrict-access-to-non-production-envs.md`.
 */
export const EARLY_ACCESS_ANNOTATION = 'early-access';

/**
 * Business error code returned by the STS (token server) when a user is denied access to a
 * restricted (`preview`/`preprod`) environment because they lack the {@link EARLY_ACCESS_ANNOTATION}
 * annotation. The UI keys its dedicated rejection screen off this code.
 */
export { RESTRICTED_ENVIRONMENT_ERROR_CODE } from './sts-errors.js';

/**
 * The account as it crosses the wire.
 *
 * Derived from `AccountSchema`, not written alongside it: the schema is what OpenAPI publishes and
 * what AJV compiles, so a hand-written twin could only ever drift from the contract actually being
 * enforced. `import type` erases at compile time, so nothing here pulls zod into a browser or SDK
 * bundle — runtime consumers reach the schemas through the `@vertesia/common/api-schemas` entry
 * point instead.
 */
export type Account = Wire.Account;
export type AccountBilling = Wire.AccountBilling;
export type UpdateAccountPayload = Wire.UpdateAccountPayload;

// The compact account reference, derived from the schema in `./api-schemas/invites.js`. It was
// hand-written for the same reason `ProjectRef` was — `ExecutionRun` and `UserInviteTokenData` still
// reach it through types the scanner derives — and is an alias now for the same reason: the scanner
// short-circuits such an alias to the published component rather than failing to expand it.
export type AccountRef = Wire.AccountRef;

export const AccountRefPopulate = 'id name';

/**
 * The account invite, onboarding and project-listing wire types, derived from
 * `./api-schemas/invites.js`.
 *
 * `AccountRef` above is the one member of this closure that stays hand-written, and only because
 * `Interaction` and `PromptTemplate` still reference it through the TypeScript scanner, which cannot
 * expand a `z.infer<>`. Everything here is reachable only from converted slots, so nothing derived
 * reads it and the alias is safe. `AccountRefSchema` is still the runtime source of truth, and the
 * `Equals` assertion in `invites.contract.test.ts` is what holds the interface to it.
 */
export type InviteUserRequestPayload = Wire.InviteUserRequestPayload;
export type InviteUserResponsePayload = Wire.InviteUserResponsePayload;
export type InviteAcceptanceResponse = Wire.InviteAcceptanceResponse;
export type InviteDeclineResponse = Wire.InviteDeclineResponse;
export type AccountProjectsResponse = Wire.AccountProjectsResponse;

export type OnboardingProgress = Wire.OnboardingProgress;

/**
 * Data collected at signup, used for onboarding and segments.
 */
export type SignupData = Wire.SignupData;

/**
 * The `POST /auth/signup` request body.
 */
export type SignupPayload = Wire.SignupPayload;

export type AccountApiVersionPolicy = Wire.AccountApiVersionPolicy;
