import type { ApiKey } from './apikey.js';
import type { ProjectRef, SystemRoles } from './project.js';

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

export enum Datacenters {
    aws = 'aws',
    gcp = 'gcp',
    azure = 'azure',
}

export enum BillingMethod {
    stripe = 'stripe',
    invoice = 'invoice',
}

export enum AccountType {
    vertesia = 'vertesia',
    partner = 'partner',
    free = 'free',
    customer = 'customer',
    prospect = 'prospect',
    unknown = 'unknown',
}

export interface AccountBilling {
    method: BillingMethod;
    stripe_customer_id?: string;
}

/**
 * Quota/rate-limit tier assigned to an account. Code-defined tiers live in `@dglabs/quota`
 * (`QUOTA_TIERS`); these names must match its keys.
 * - `standard` — protective baseline limits (the default for most accounts).
 * - `enterprise` — high limits for contracted customers / internal / partners.
 *
 * An account with no explicit `quota_tier` derives its tier from its `account_type`.
 */
export enum QuotaTier {
    standard = 'standard',
    enterprise = 'enterprise',
}

/**
 * Default tier for an account that has no explicit `quota_tier`, derived from its `account_type`:
 * contracted customers and internal Vertesia accounts get `enterprise`; everyone else (partner,
 * free, prospect, unknown) gets the protective `standard` baseline.
 */
export function quotaTierForAccountType(accountType: AccountType | undefined | null): QuotaTier {
    switch (accountType) {
        case AccountType.customer:
        case AccountType.vertesia:
            return QuotaTier.enterprise;
        default:
            return QuotaTier.standard;
    }
}

export const ACCOUNT_NAMESPACE_MAX_LENGTH = 63;
export const ACCOUNT_APP_ACCESS_MESSAGE_MAX_LENGTH = 1000;
export const RESERVED_ACCOUNT_NAMESPACES = [
    'admin',
    'api',
    'apps',
    'auth',
    'cdn',
    'docs',
    'internal-auth',
    'mcp',
    'status',
    'sts',
    'www',
] as const;

const ACCOUNT_NAMESPACE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeAccountNamespace(namespace: string): string {
    return namespace.trim().toLowerCase();
}

export function getAccountNamespaceValidationError(namespace: string): string | undefined {
    if (!namespace) {
        return 'Account namespace is required';
    }
    if (namespace.length > ACCOUNT_NAMESPACE_MAX_LENGTH || !ACCOUNT_NAMESPACE_PATTERN.test(namespace)) {
        return 'Account namespace must be a lowercase DNS label containing only letters, numbers, and hyphens';
    }
    if ((RESERVED_ACCOUNT_NAMESPACES as readonly string[]).includes(namespace)) {
        return `Account namespace '${namespace}' is reserved`;
    }
    return undefined;
}

export interface Account {
    id: string;
    name: string;

    /** Public DNS-label-compatible identifier used by organization app domains. */
    namespace?: string;

    /**
     * Plain-text instructions shown when a signed-in user has no application access.
     * @maxLength 1000
     */
    app_access_message?: string;

    email_domains: string[];

    onboarding: {
        completed: boolean;
        completed_at: Date;
    };

    datacenter: string;

    account_type: AccountType;

    billing: AccountBilling;

    /** Quota/rate-limit tier. Unset → the deployment default tier (env `QUOTA_BASE_TIER`). */
    quota_tier?: QuotaTier;

    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export interface UpdateAccountPayload {
    name?: string;
    /** @maxLength 1000 */
    app_access_message?: string;
    email_domains?: string[];
    billing?: AccountBilling;
    quota_tier?: QuotaTier;
}

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
