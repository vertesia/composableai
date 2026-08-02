import type { z } from 'zod';
import type {
    CreateSecretRequestSchema,
    ListSecretsQuerySchema,
    ListSecretsResponseSchema,
    SecretKindSchema,
    SecretLookupQuerySchema,
    SecretProjectQuerySchema,
    SecretRecordSchema,
    UpdateSecretRequestSchema,
} from './api-schemas/studio-remaining.js';
import type { EventCategory } from './platform-event.js';

// First supported top-level secret kind. OAuth connector grants continue to use
// the OAuth/MCP token flows and can be materialized later by tools that need them.
export type SecretKind = z.infer<typeof SecretKindSchema>;

export type SecretProjectQuery = z.infer<typeof SecretProjectQuerySchema>;

export type ListSecretsQuery = z.infer<typeof ListSecretsQuerySchema>;

export type SecretLookupQuery = z.infer<typeof SecretLookupQuerySchema>;

export type SecretRecord = z.infer<typeof SecretRecordSchema>;

export type ListSecretsResponse = z.infer<typeof ListSecretsResponseSchema>;

export type CreateSecretRequest = z.infer<typeof CreateSecretRequestSchema>;

export type UpdateSecretRequest = z.infer<typeof UpdateSecretRequestSchema>;

export interface EventWebhookSigningSecretRequest {
    account_id?: string;
    project_id: string;
}

export interface EventWebhookSigningSecretResponse {
    subscription_id: string;
    secret: string;
    secret_label: string;
}

export interface SignEventWebhookRequest extends EventWebhookSigningSecretRequest {
    delivery_id: string;
    body: string;
    event_id: string;
    event_category: EventCategory;
    action: string;
    timestamp?: number;
}

export interface SignEventWebhookResponse {
    headers: Record<string, string>;
    timestamp: number;
    signature: string;
}

export interface EventIngestSigningSecretRequest {
    account_id?: string;
    project_id: string;
}

export interface EventIngestSigningSecretResponse {
    channel_id: string;
    secret: string;
    secret_label: string;
}

export interface VerifyEventIngestSignatureRequest extends EventIngestSigningSecretRequest {
    /** Raw request body bytes (exactly as received) the sender signed. */
    body: string;
    /** Signature value from the request header. */
    signature_header: string;
    algorithm?: 'sha256' | 'sha1';
    encoding?: 'hex' | 'base64';
    /** Literal prefix to strip from the header value, e.g. `sha256=`. */
    prefix?: string;
}

export interface VerifyEventIngestSignatureResponse {
    valid: boolean;
}

export interface GithubInstallationTokenRequest {
    account_id?: string;
    project_id: string;
    /** Numeric GitHub App installation id (from the trusted webhook payload, never agent-supplied). */
    installation_id: string;
    /** `owner/name` of the repo to scope the token to. Required — tokens are always repository-scoped. */
    repo: string;
}

export interface GithubInstallationTokenResponse {
    /** Short-lived, repository-scoped GitHub App installation token. */
    token: string;
    /** ISO-8601 expiry returned by GitHub, when available. */
    expires_at?: string;
}
