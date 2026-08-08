import type { z } from 'zod';
import type { PropertyConditions } from './access-control.js';
import type {
    ApiKeyArraySchema,
    ApiKeyListQuerySchema,
    ApiKeyReadQuerySchema,
    ApiKeyReadResponseSchema,
    ApiKeySchema,
    ApiKeyWithValueSchema,
    AuthTokenResponseSchema,
    CreateApiKeyPayloadSchema,
    UpdateApiKeyPayloadSchema,
} from './api-schemas/apikey.js';
import type { UserGroupRef } from './group.js';
import type { ProjectRef, SystemRoles } from './project.js';
import type { AccountRef } from './user.js';

/**
 * `ApiKeyTypes` lives in `./apikey-values.js` so the API schemas can read it without importing this
 * module back. Re-exported here so every existing import path keeps working.
 */
export * from './apikey-values.js';

/**
 * Per-scope, per-verb property-condition arrays that narrow resource access.
 * Each value array uses $or semantics — any matching condition set grants
 * access. The consumer defines when the presence of its scope switches access
 * from the baseline to restrict mode.
 *
 * The bare keys `read`/`write`/`delete` apply to the default `'document'`
 * scope. They also receive entries emitted by system-role ABAC ACEs (which
 * predate the scope concept).
 *
 * Non-default scopes appear as prefixed keys: `'collection:read'`,
 * `'agent_run:control'`, `'task:read'`, etc. — the prefix is the
 * `AceConditions.scope` value, the suffix is the verb derived from the
 * ABAC role's permission set.
 *
 * Consumers that aren't scope-aware can keep reading only the bare keys.
 */
export interface ContentSecurity {
    read?: PropertyConditions[];
    write?: PropertyConditions[];
    delete?: PropertyConditions[];
    /** Scope-prefixed entries: `'collection:read'`, `'agent_run:control'`, etc. */
    [scopedKey: string]: PropertyConditions[] | undefined;
}

/**
 * The API key wire types, inferred from the schemas in `./api-schemas/apikey.js` — what OpenAPI
 * publishes and AJV compiles.
 *
 * NOTE the timestamps are `string`, not `Date`. The document has always published them as
 * `format: date-time` strings and JSON has no date type, so the previous `Date` declaration
 * described the Mongoose document rather than the response a client parses.
 */
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type ApiKeyArray = z.infer<typeof ApiKeyArraySchema>;
/**
 * Create and update take DIFFERENT payloads, and did not before.
 *
 * `CreateOrUpdateApiKeyPayload` was `Partial<ApiKey>` shared by both, which meant the type permitted
 * a create with no `role` (rejected by Mongoose inside the handler) and an update that omitted
 * `role` (which unset a required path). Splitting it is source-breaking for the SDK and is announced
 * as a release operation; the two names say which operation they belong to.
 */
export type CreateApiKeyPayload = z.infer<typeof CreateApiKeyPayloadSchema>;
export type UpdateApiKeyPayload = z.infer<typeof UpdateApiKeyPayloadSchema>;
export type ApiKeyWithValue = z.infer<typeof ApiKeyWithValueSchema>;
export type ApiKeyReadResponse = z.infer<typeof ApiKeyReadResponseSchema>;

export interface CreatePublicKeyPayload {
    name?: string;
    projectId?: string;
    ttl?: number;
}

export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;
export type ApiKeyListQuery = z.infer<typeof ApiKeyListQuerySchema>;
export type ApiKeyReadQuery = z.infer<typeof ApiKeyReadQuerySchema>;

export interface AuthTokenPayload {
    sub: string;
    name: string;
    email?: string;
    picture?: string;

    type: PrincipalType;
    account: AccountRef;

    account_roles: SystemRoles[];
    accounts: AccountRef[];

    project?: ProjectRef;
    project_roles?: SystemRoles[];

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

    /** Scoped ABAC conditions keyed by operation.
     *  Each resource consumer defines its baseline/restrict composition.
     *
     *  Transitional: this field is being renamed to `abac` (see [[pending-migrations]]).
     *  Both fields are typed so consumers can dual-read during the transition.
     *  Only one will ever be populated in a given token. */
    content_security?: ContentSecurity;
    /**
     * New name for `content_security`. Consumers should prefer this field and
     * fall back to `content_security`. Sts will be flipped to emit this field
     * once all consumers have shipped their dual-read.
     */
    abac?: ContentSecurity;

    /**
     * API endpoints information to be used with this token.
     * Either an API domain like 'api.vertesia.io' | 'api-preview.vertesia.io' | 'api.us1.vertesia.io' | 'local'
     * or explicit studio, store, and token URLs.
     */
    endpoints?:
        | string
        | {
              studio: string;
              store: string;
              token?: string;
              git?: string;
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

    /**
     * Set only by STS for tokens minted by an attested internal workflow-launching service.
     * API servers use this claim before accepting a caller-supplied logical request identity.
     */
    trusted_request_identity?: boolean;
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
