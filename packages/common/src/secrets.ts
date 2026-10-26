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

export type DeleteSecretResponse = Wire.DeleteSecretResponse;
