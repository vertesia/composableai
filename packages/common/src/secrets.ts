import type { z } from 'zod';
import type {
    CreateSecretRequestSchema,
    DeleteSecretResponseSchema,
    EventIngestSigningSecretRequestSchema,
    EventIngestSigningSecretResponseSchema,
    EventWebhookSigningSecretRequestSchema,
    EventWebhookSigningSecretResponseSchema,
    GithubInstallationTokenRequestSchema,
    GithubInstallationTokenResponseSchema,
    ListSecretsQuerySchema,
    ListSecretsResponseSchema,
    SecretKindSchema,
    SecretLookupQuerySchema,
    SecretProjectQuerySchema,
    SecretRecordSchema,
    SignEventWebhookRequestSchema,
    SignEventWebhookResponseSchema,
    UpdateSecretRequestSchema,
    VerifyEventIngestSignatureRequestSchema,
    VerifyEventIngestSignatureResponseSchema,
} from './api-schemas/secrets.js';

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

export type EventWebhookSigningSecretRequest = z.infer<typeof EventWebhookSigningSecretRequestSchema>;
export type EventWebhookSigningSecretResponse = z.infer<typeof EventWebhookSigningSecretResponseSchema>;
export type SignEventWebhookRequest = z.infer<typeof SignEventWebhookRequestSchema>;
export type SignEventWebhookResponse = z.infer<typeof SignEventWebhookResponseSchema>;
export type EventIngestSigningSecretRequest = z.infer<typeof EventIngestSigningSecretRequestSchema>;
export type EventIngestSigningSecretResponse = z.infer<typeof EventIngestSigningSecretResponseSchema>;
export type VerifyEventIngestSignatureRequest = z.infer<typeof VerifyEventIngestSignatureRequestSchema>;
export type VerifyEventIngestSignatureResponse = z.infer<typeof VerifyEventIngestSignatureResponseSchema>;
export type GithubInstallationTokenRequest = z.infer<typeof GithubInstallationTokenRequestSchema>;
export type GithubInstallationTokenResponse = z.infer<typeof GithubInstallationTokenResponseSchema>;

export type DeleteSecretResponse = z.infer<typeof DeleteSecretResponseSchema>;
