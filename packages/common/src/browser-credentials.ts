import type { z } from 'zod';
import type {
    WebsiteCredentialCapabilitySchema,
    WebsiteCredentialFillRequestSchema,
    WebsiteCredentialFillResponseSchema,
    WebsiteCredentialMetadataSchema,
    WebsiteCredentialRecordSchema,
    WebsiteCredentialSecretInputSchema,
    WebsiteCredentialTotpAlgorithmSchema,
    WebsiteCredentialTotpMetadataSchema,
    WebsiteCredentialWebsiteSchema,
} from './api-schemas/secrets.js';
export type WebsiteCredentialCapability = z.infer<typeof WebsiteCredentialCapabilitySchema>;

export type WebsiteCredentialTotpAlgorithm = z.infer<typeof WebsiteCredentialTotpAlgorithmSchema>;

export type WebsiteCredentialWebsite = z.infer<typeof WebsiteCredentialWebsiteSchema>;

export type WebsiteCredentialTotpMetadata = z.infer<typeof WebsiteCredentialTotpMetadataSchema>;

export type WebsiteCredentialMetadata = z.infer<typeof WebsiteCredentialMetadataSchema>;

export type WebsiteCredentialRecord = z.infer<typeof WebsiteCredentialRecordSchema>;

export type WebsiteCredentialSecretInput = z.infer<typeof WebsiteCredentialSecretInputSchema>;

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

export type WebsiteCredentialFillRequest = z.infer<typeof WebsiteCredentialFillRequestSchema>;

export type WebsiteCredentialFillResponse = z.infer<typeof WebsiteCredentialFillResponseSchema>;
