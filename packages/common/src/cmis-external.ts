/**
 * Types for external CMIS connections — Vertesia acting as a CMIS *client*
 * to a remote repository (Alfresco, Nuxeo, SharePoint via CMIS, etc.).
 *
 * Credentials live in the existing `encrypted_secrets` collection with
 * `kind: 'integration_key'` and `purpose: 'cmis:${connectionId}'`. For OAuth
 * the connection references an existing `OAuthApp` via `oauth_provider_id`.
 */

export type CmisAuthType = 'basic' | 'bearer' | 'oauth';

/** Public, non-secret view of a connection (safe to list). */
export interface CmisExternalConnection {
    id: string;
    project_id: string;
    name: string;
    url: string;
    /** Remote CMIS repositoryId. Optional — if omitted, the first repo is used. */
    repository_id?: string;
    auth_type: CmisAuthType;
    /** Username for basic auth (not a secret — kept plaintext on the record). */
    username?: string;
    /** Reference to an existing OAuthProvider when auth_type === 'oauth'. */
    oauth_provider_id?: string;
    /** Last 4 chars of the api key / password, for UI display only. */
    secret_hint?: string;
    has_secret: boolean;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

/** Payload to create a connection. Secrets are encrypted before storage. */
export interface CreateCmisExternalConnectionPayload {
    name: string;
    url: string;
    repository_id?: string;
    auth_type: CmisAuthType;
    enabled?: boolean;
    /** Required when auth_type === 'basic'. */
    username?: string;
    /** Required when auth_type === 'basic'. */
    password?: string;
    /** Required when auth_type === 'bearer'. */
    api_key?: string;
    /** Required when auth_type === 'oauth'. */
    oauth_provider_id?: string;
}

/** PATCH payload — secrets are only updated when their field is present. */
export interface UpdateCmisExternalConnectionPayload {
    name?: string;
    url?: string;
    repository_id?: string;
    enabled?: boolean;
    username?: string;
    password?: string;
    api_key?: string;
    oauth_provider_id?: string;
}

/** Response shape for a `repositoryInfo` discovery probe. */
export interface CmisExternalDiscoveryResult {
    ok: boolean;
    repositoryId?: string;
    repositoryName?: string;
    productName?: string;
    cmisVersionSupported?: string;
    rootFolderId?: string;
    /** Set when ok=false; carries the upstream error message. */
    error?: string;
}
