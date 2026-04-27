import { PropertyConditions } from "./access-control.js";
import { UserGroupRef } from "./group.js";
import { ProjectRef, ProjectRoles } from "./project.js";
import { AccountRef } from "./user.js";

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
    secret = "sk",
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

export interface ApiKeyWithValue extends Omit<ApiKey, "maskedValue"> {
    value: string;
}

export interface CreatePublicKeyPayload {
    name?: string;
    projectId?: string;
    ttl?: number;
}

export interface AuthTokenResponse {
    token: string;
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
     * The user ID (if any) attached to the token.
     * This is set when the token is a user token or an agent token running as a user.
     * Not set for impersonating tokens like project tokens.
     */
    user_id?: string;

    /** groups */
    groups?: UserGroupRef[]; //group ids

    /** Merged user + group properties for dynamic permission matching.
     *  User properties take precedence over group properties. */
    properties?: Record<string, any>;

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
    User = "user",
    Group = "group",
    ApiKey = "apikey",
    ServiceAccount = "service_account",
    Agent = "agent",
    Schedule = "schedule",
}
