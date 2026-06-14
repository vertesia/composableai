import type { ApiKey } from './apikey.js';
import type { ProjectRef, ProjectRoles } from './project.js';

export interface UserWithAccounts extends User {
    accounts: AccountRef[];
}

export interface User {
    id: string;
    externalId: string;
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
 * (`QUOTA_TIERS`); these names must match its keys. An account with no `quota_tier` follows the
 * deployment's default tier (env `QUOTA_BASE_TIER`).
 * - `standard` — protective baseline limits for tester partners / unassigned (the production default).
 * - `enterprise` — high limits for contracted customers.
 * - `default` — no-op (the limiter's own static constants stand).
 * - `dev` — very low limits for branch/test deployments.
 */
export enum QuotaTier {
    default = 'default',
    dev = 'dev',
    standard = 'standard',
    enterprise = 'enterprise',
}

export interface Account {
    id: string;
    name: string;

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
    role: ProjectRoles;
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
