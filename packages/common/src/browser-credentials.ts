import type * as Wire from './wire-types.generated.js';
export type WebsiteCredentialCapability = Wire.WebsiteCredentialCapability;

export type WebsiteCredentialTotpAlgorithm = Wire.WebsiteCredentialTotpAlgorithm;

export type WebsiteCredentialWebsite = Wire.WebsiteCredentialWebsite;

export type WebsiteCredentialTotpMetadata = Wire.WebsiteCredentialTotpMetadata;

export type WebsiteCredentialMetadata = Wire.WebsiteCredentialMetadata;

export type WebsiteCredentialRecord = Wire.WebsiteCredentialRecord;

export type WebsiteCredentialSecretInput = Wire.WebsiteCredentialSecretInput;

export interface CreateWebsiteCredentialRequest extends WebsiteCredentialMetadata {
    secret?: WebsiteCredentialSecretInput;
}

export interface UpdateWebsiteCredentialRequest extends Partial<WebsiteCredentialMetadata> {
    secret?: WebsiteCredentialSecretInput;
    clear_username_secret?: boolean;
    clear_password?: boolean;
    clear_totp?: boolean;
    clear_oauth?: boolean;
}

export type WebsiteCredentialFillRequest = Wire.WebsiteCredentialFillRequest;

export type WebsiteCredentialFillResponse = Wire.WebsiteCredentialFillResponse;

export type WebsiteCredentialMetadataUpdate = Wire.WebsiteCredentialMetadataUpdate;
