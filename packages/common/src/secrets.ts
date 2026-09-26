import type * as Wire from './wire-types.generated.js';

// First supported top-level secret kind. OAuth connector grants continue to use
// the OAuth/MCP token flows and can be materialized later by tools that need them.
export type SecretKind = Wire.SecretKind;

export type SecretProjectQuery = Wire.SecretProjectQuery;

export type ListSecretsQuery = Wire.ListSecretsQuery;

export type SecretLookupQuery = Wire.SecretLookupQuery;

export type SecretRecord = Wire.SecretRecord;

export type ListSecretsResponse = Wire.ListSecretsResponse;

export type CreateSecretRequest = Wire.CreateSecretRequest;

export type UpdateSecretRequest = Wire.UpdateSecretRequest;

export type EventWebhookSigningSecretRequest = Wire.EventWebhookSigningSecretRequest;
export type EventWebhookSigningSecretResponse = Wire.EventWebhookSigningSecretResponse;
export type SignEventWebhookRequest = Wire.SignEventWebhookRequest;
export type SignEventWebhookResponse = Wire.SignEventWebhookResponse;
export type EventIngestSigningSecretRequest = Wire.EventIngestSigningSecretRequest;
export type EventIngestSigningSecretResponse = Wire.EventIngestSigningSecretResponse;
export type VerifyEventIngestSignatureRequest = Wire.VerifyEventIngestSignatureRequest;
export type VerifyEventIngestSignatureResponse = Wire.VerifyEventIngestSignatureResponse;
export type GithubInstallationTokenRequest = Wire.GithubInstallationTokenRequest;
export type GithubInstallationTokenResponse = Wire.GithubInstallationTokenResponse;

export type DeleteSecretResponse = Wire.DeleteSecretResponse;
