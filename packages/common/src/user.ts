import type {
    AccountBillingFromSchema,
    AccountFromSchema,
    UpdateAccountPayloadFromSchema,
} from './api-schemas/account.js';
import type { ApiKey } from './apikey.js';
import type { ProjectRef, SystemRoles } from './project.js';

export * from './account-values.js';

export interface UserWithAccounts extends User {
    accounts: AccountRef[];
}

export interface User {
    id: string;
    externalId?: string;
    email: string;
    name: string;
    username?: string;
    picture?: string;
    language?: string;
    phone?: string;
    sign_in_provider?: string;
    last_selected_account?: string;
    source?: 'firebase' | 'scim';
    updated_by?: string;
    /** Custom properties for dynamic permission matching */
    properties?: Record<string, unknown>;
    /** BLP clearance level — determines max document sensitivity the user can access */
    clearance?: number;
    /** Compartments the user belongs to — restricts access to documents in matching compartments */
    compartments?: string[];
    /** Free-form user metadata - restricted to internal use */
    annotations?: string[];
}

export interface UpdateUserPayload {
    name?: string;
    username?: string;
    picture?: string;
    language?: string;
    phone?: string;
    last_selected_account?: string;
    properties?: Record<string, unknown>;
    clearance?: number;
    compartments?: string[];
}

export interface UserRef {
    id: string;
    name: string;
    email: string;
    picture?: string;
}

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
export const RESTRICTED_ENVIRONMENT_ERROR_CODE = 'restricted_environment';

/**
 * The account as it crosses the wire.
 *
 * Derived from `AccountSchema`, not written alongside it: the schema is what OpenAPI publishes and
 * what AJV compiles, so a hand-written twin could only ever drift from the contract actually being
 * enforced. `import type` erases at compile time, so nothing here pulls zod into a browser or SDK
 * bundle — runtime consumers reach the schemas through the `@vertesia/common/api-schemas` entry
 * point instead.
 */
export type Account = AccountFromSchema;
export type AccountBilling = AccountBillingFromSchema;
export type UpdateAccountPayload = UpdateAccountPayloadFromSchema;

export interface AccountRef {
    id: string;
    name: string;
}

export const AccountRefPopulate = 'id name';

export interface InviteUserRequestPayload {
    email: string;
    role: SystemRoles;
}

export interface InviteUserResponsePayload {
    action: 'invited' | 'added';
}

export interface InviteAcceptanceResponse {
    status: 'added';
}

export interface InviteDeclineResponse {
    status: 'deleted';
}

export interface AccountProjectsResponse {
    data: ProjectRef[];
}

type UserOrApiKey<T extends User | ApiKey> = T extends User ? User : ApiKey;
type SessionType<T extends User | ApiKey> = T extends User ? 'user' : 'apikey';
export interface SessionInfo<T extends User | ApiKey> {
    isNew?: boolean;
    type: SessionType<T>;
    subject: UserOrApiKey<T>;
    //User | ApiKey; // no user if using an apikey
    current_account: Account;
    //role: string; // TODO the role on the selected account
    accounts: AccountRef[];
}

export interface UserSessionInfo extends SessionInfo<User> {}
export interface ApiKeySessionInfo extends SessionInfo<ApiKey> {}

export interface OnboardingProgress {
    interactions: boolean;
    prompts: boolean;
    environments: boolean;
    default_environment_defined: boolean;
}

/**
 * Data collected at signup
 * used for onboarding and segments
 **/
export interface SignupData {
    accountType: string;
    companyName?: string;
    companySize?: number;
    companyWebsite?: string;
    maturity?: string;
}

/**
 * Signup Payload: used to create a new user
 */
export interface SignupPayload {
    firebaseToken: string;
    signupData: SignupData;
}
