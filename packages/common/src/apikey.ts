import type { PropertyConditions } from './access-control.js';
import type { UserGroupRef } from './group.js';
import type { ProjectRef, ProjectRoles } from './project.js';
import type { AccountRef } from './user.js';

/**
 * Content security conditions in the JWT, keyed by permission type.
 * Each key maps to an array of condition sets — at query time, any matching set grants access ($or).
 * Presence of this object in the JWT switches content access from allow-all to restrict mode.
 */
export interface ContentSecurity {
    read?: PropertyConditions[];
    write?: PropertyConditions[];
    delete?: PropertyConditions[];
}

export enum ApiKeyTypes {
    secret = 'sk',
}
export interface ApiKey {
    id: string;
    name: string;
    type: ApiKeyTypes;
    role: ProjectRoles;
    maskedValue?: string; //masked value
    can_retrieve_value?: boolean;
    account: string; // the account id
    project: ProjectRef; // the project id if any
    enabled: boolean;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
    expires_at?: Date; // in case of public key only
}

export interface CreateOrUpdateApiKeyPayload extends Partial<ApiKey> {}

export interface ApiKeyWithValue extends ApiKey {
    value: string;
}

export interface ApiKeyReadResponse extends ApiKey {
    value?: string;
}

export interface CreatePublicKeyPayload {
    name?: string;
    projectId?: string;
    ttl?: number;
}

export interface AuthTokenResponse {
    token: string;
}

export interface ApiKeyListQuery {
    level?: 'account' | 'project';
}

export interface ApiKeyReadQuery {
    withValue?: boolean;
}

export interface AuthTokenPayload {
    sub: string;
    name: string;
    email?: string;
    picture?: string;

    type: PrincipalType;
    account: AccountRef;

    account_roles: ProjectRoles[];
    accounts: AccountRef[];

    project?: ProjectRef;
    project_roles?: ProjectRoles[];

    /**
     * The app names enabled for this token. Defaults to an empty array if no apps are enabled.
     */
    apps: string[];

    /**
     * Apps in `apps[]` whose UI surface is restricted for this principal — present only on
     * user tokens, and only when at least one app applies. Such apps grant functional access
     * (tools, endpoints, contributions) but the portal must hide them from navigation unless
     * the user holds an explicit app_member ACE.
     *
     * UI consumers should treat an app as visible when:
     *   `apps.includes(name) && !ui_restrictions?.includes(name)`
     *
     * Omitted entirely when empty to keep the JWT compact. Not emitted on agent or service
     * tokens — those carry only the functional `apps[]` set.
     */
    ui_restrictions?: string[];

    /**
     * The user ID (if any) attached to the token.
     * This is set when the token is a user token or an agent token running as a user.
     * Not set for impersonating tokens like project tokens.
     */
    user_id?: string;

    /** groups */
    groups?: UserGroupRef[]; //group ids

    /** Content security conditions keyed by permission (read/write/delete).
     *  Presence triggers restrict mode: project:* is dropped from security filters. */
    content_security?: ContentSecurity;

    /**
     * API endpoints information to be used with this token.
     * Either a n API domain like 'api.vertesia.io' | 'api-preview.vertesia.io' | 'api-staging.vertesia.io' | 'local'
     * or explicit studio, store, and token URLs.
     */
    endpoints?:
        | string
        | {
              studio: string;
              store: string;
              token?: string;
              inference?: string;
          };

    iss: string; //issuer
    aud: string; //audience
    exp: number; //expires in (EPOC seconds)
    tags?: string[]; //tags

    permissions?: string[]; //permissions
    scopes?: string[]; //scopes

    /**
     * Service caller information for agent and service account tokens.
     * Contains audit information about who/what initiated the token request.
     * For agent tokens, includes `onBehalfOf` with the original user's token payload.
     */
    service_caller?: {
        /** The principal that requested the token (e.g., service account identity) */
        id?: string;
        name?: string;
        email?: string;
        /**
         * For agent tokens: the verified token payload of the user/apikey the agent acts on behalf of.
         * Contains the original user's name, email, picture, user_id, etc.
         */
        onBehalfOf?: AuthTokenPayload;
        [key: string]: unknown;
    };
}

export enum PrincipalType {
    User = 'user',
    OAuthAccess = 'oauth_access',
    Group = 'group',
    ApiKey = 'apikey',
    ServiceAccount = 'service_account',
    Agent = 'agent',
    Schedule = 'schedule',
}
