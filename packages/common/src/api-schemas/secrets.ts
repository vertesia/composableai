// Runtime schemas for the secrets API domain.
import { z } from 'zod';
import { EventCategorySchema } from './audit-trail.js';

export const EventWebhookSigningSecretRequestSchema = z
    .strictObject({
        account_id: z.string().optional(),
        project_id: z.string(),
    })
    .meta({ id: 'EventWebhookSigningSecretRequest' });

export const EventWebhookSigningSecretResponseSchema = z
    .strictObject({
        subscription_id: z.string(),
        secret: z.string(),
        secret_label: z.string(),
    })
    .meta({ id: 'EventWebhookSigningSecretResponse' });

export const SignEventWebhookRequestSchema = EventWebhookSigningSecretRequestSchema.extend({
    delivery_id: z.string(),
    body: z.string(),
    event_id: z.string(),
    event_category: EventCategorySchema,
    action: z.string(),
    timestamp: z.number().optional(),
}).meta({ id: 'SignEventWebhookRequest' });

export const SignEventWebhookResponseSchema = z
    .strictObject({
        headers: z.record(z.string(), z.string()),
        timestamp: z.number(),
        signature: z.string(),
    })
    .meta({ id: 'SignEventWebhookResponse' });

export const EventIngestSigningSecretRequestSchema = z
    .strictObject({
        account_id: z.string().optional(),
        project_id: z.string(),
    })
    .meta({ id: 'EventIngestSigningSecretRequest' });

export const EventIngestSigningSecretResponseSchema = z
    .strictObject({
        channel_id: z.string(),
        secret: z.string(),
        secret_label: z.string(),
    })
    .meta({ id: 'EventIngestSigningSecretResponse' });

export const VerifyEventIngestSignatureRequestSchema = EventIngestSigningSecretRequestSchema.extend({
    body: z.string(),
    signature_header: z.string(),
    algorithm: z.enum(['sha256', 'sha1']).optional(),
    encoding: z.enum(['hex', 'base64']).optional(),
    prefix: z.string().optional(),
}).meta({ id: 'VerifyEventIngestSignatureRequest' });

export const VerifyEventIngestSignatureResponseSchema = z
    .strictObject({
        valid: z.boolean(),
    })
    .meta({ id: 'VerifyEventIngestSignatureResponse' });

export const GithubInstallationTokenRequestSchema = z
    .strictObject({
        account_id: z.string().optional(),
        project_id: z.string(),
        installation_id: z.string(),
        repo: z.string(),
    })
    .meta({ id: 'GithubInstallationTokenRequest' });

export const GithubInstallationTokenResponseSchema = z
    .strictObject({
        token: z.string(),
        expires_at: z.string().optional(),
    })
    .meta({ id: 'GithubInstallationTokenResponse' });

export const InternalSecretDeleteResponseSchema = z
    .strictObject({
        deleted: z.literal(true),
    })
    .meta({ id: 'InternalSecretDeleteResponse' });

export const WebsiteCredentialTotpAlgorithmSchema = z
    .enum(['SHA1', 'SHA256', 'SHA512'])
    .meta({ id: 'WebsiteCredentialTotpAlgorithm' });

export const WebsiteCredentialTotpMetadataSchema = z
    .strictObject({
        algorithm: WebsiteCredentialTotpAlgorithmSchema.optional(),
        digits: z
            .union([z.literal(6), z.literal(8)])
            .meta({ anyOf: undefined, type: 'number', enum: [6, 8] })
            .optional(),
        period: z.number().optional(),
        issuer: z.string().optional(),
        account: z.string().optional(),
    })
    .meta({ id: 'WebsiteCredentialTotpMetadata' });

export const WebsiteCredentialSecretInputSchema = z
    .strictObject({
        username: z
            .string()
            .meta({
                description:
                    'Optional encrypted username. Prefer metadata.username unless the username itself is sensitive.',
            })
            .optional(),
        password: z.string().optional(),
        totp: z
            .strictObject({
                seed: z.string(),
                algorithm: WebsiteCredentialTotpAlgorithmSchema.optional(),
                digits: z
                    .union([z.literal(6), z.literal(8)])
                    .meta({ anyOf: undefined, type: 'number', enum: [6, 8] })
                    .optional(),
                period: z.number().optional(),
                issuer: z.string().optional(),
                account: z.string().optional(),
            })
            .optional(),
        oauth: z
            .strictObject({
                provider_id: z.string().optional(),
                token_owner: z.enum(['user', 'project']).optional(),
                token_ref: z.string().optional(),
            })
            .meta({
                description: 'Future OAuth materialization hook. The token itself remains in the OAuth secret store.',
            })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialSecretInput' });

export const WebsiteCredentialCapabilitySchema = z
    .enum(['password', 'totp', 'oauth'])
    .meta({ id: 'WebsiteCredentialCapability' });

export const WebsiteCredentialWebsiteSchema = z
    .strictObject({
        host: z.string().meta({ description: 'Hostname this credential is allowed on. Subdomains match.' }),
        login_url: z.string().meta({ description: 'Optional login URL used by agents as a hint.' }).optional(),
        allowed_origins: z
            .array(z.string())
            .meta({ description: 'Optional narrower origin allowlist for this credential.' })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialWebsite' });

export const SecretKindSchema = z.literal('website_credential').meta({ id: 'SecretKind' });

export const SecretProjectQuerySchema = z
    .object({
        project_id: z
            .string()
            .meta({
                description: 'Project scope for top-level secret APIs. Must match the authenticated project context.',
            })
            .optional(),
    })
    .meta({ id: 'SecretProjectQuery' });

export const ListSecretsQuerySchema = SecretProjectQuerySchema.extend({
    kind: SecretKindSchema.optional(),
    host: z.string().optional(),
    enabled: z.boolean().optional(),
}).meta({ id: 'ListSecretsQuery' });

export const SecretLookupQuerySchema = SecretProjectQuerySchema.extend({
    kind: SecretKindSchema.optional(),
}).meta({ id: 'SecretLookupQuery' });

export const WebsiteCredentialRecordSchema = z
    .strictObject({
        id: z.string(),
        credential_ref: z.string(),
        project: z.string(),
        name: z.string(),
        websites: z.array(WebsiteCredentialWebsiteSchema),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret_enabled: z.boolean(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp_metadata: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        has_username_secret: z.boolean(),
        has_password: z.boolean(),
        has_totp: z.boolean(),
        has_oauth: z.boolean(),
        password_hint: z.string().optional(),
    })
    .meta({ id: 'WebsiteCredentialRecord' });

export const WebsiteCredentialFillResponseSchema = z
    .strictObject({
        ok: z.boolean(),
        credential_ref: z.string(),
        url: z.string(),
        title: z.string(),
        filled: z.strictObject({
            username: z.boolean(),
            password: z.boolean(),
            totp: z.boolean(),
            submitted: z.boolean(),
        }),
    })
    .meta({ id: 'WebsiteCredentialFillResponse' });

export const WebsiteCredentialFillRequestSchema = z
    .strictObject({
        username_target_id: z.string().optional(),
        password_target_id: z.string().optional(),
        totp_target_id: z.string().optional(),
        submit_target_id: z.string().optional(),
        browser_workflow_id: z.string().meta({
            description:
                'Browser-use parent workflow id. The API resolves the Daytona sandbox and observes the current page server-side before decrypting the credential.',
        }),
    })
    .meta({ id: 'WebsiteCredentialFillRequest' });

export const DeleteSecretResponseSchema = z
    .strictObject({
        ok: z.boolean(),
    })
    .meta({ id: 'DeleteSecretResponse' });

export const WebsiteCredentialMetadataSchema = z
    .strictObject({
        name: z.string(),
        websites: z.array(WebsiteCredentialWebsiteSchema),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret: z.boolean().optional(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialMetadata' });

export const WebsiteCredentialMetadataUpdateSchema = z
    .strictObject({
        name: z.string().optional(),
        websites: z.array(WebsiteCredentialWebsiteSchema).optional(),
        username: z.string().optional(),
        username_hint: z.string().optional(),
        username_secret: z.boolean().optional(),
        properties: z.looseObject({}).optional(),
        tags: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        capabilities: z.array(WebsiteCredentialCapabilitySchema).optional(),
        notes: z.string().optional(),
        totp: WebsiteCredentialTotpMetadataSchema.optional(),
        expires_at: z
            .string()
            .meta({
                description:
                    'Optional ISO timestamp after which the credential is no longer usable. Expired credentials are hidden from lookup and cannot be filled.',
            })
            .optional(),
    })
    .meta({ id: 'WebsiteCredentialMetadataUpdate' });

export const SecretRecordSchema = z
    .strictObject({
        id: z.string(),
        secret_ref: z.string(),
        kind: SecretKindSchema,
        project: z.string(),
        name: z.string(),
        enabled: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        properties: z.looseObject({}).optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        details: WebsiteCredentialRecordSchema.optional(),
    })
    .meta({ id: 'SecretRecord' });

export const CreateSecretRequestSchema = z
    .strictObject({
        kind: SecretKindSchema,
        metadata: WebsiteCredentialMetadataSchema,
        secret: WebsiteCredentialSecretInputSchema.optional(),
    })
    .meta({ id: 'CreateSecretRequest' });

export const UpdateSecretRequestSchema = z
    .strictObject({
        kind: SecretKindSchema.optional(),
        metadata: WebsiteCredentialMetadataUpdateSchema.optional(),
        secret: WebsiteCredentialSecretInputSchema.optional(),
        clear_username_secret: z.boolean().optional(),
        clear_password: z.boolean().optional(),
        clear_totp: z.boolean().optional(),
        clear_oauth: z.boolean().optional(),
    })
    .meta({ id: 'UpdateSecretRequest' });

export const ListSecretsResponseSchema = z
    .strictObject({
        secrets: z.array(SecretRecordSchema),
    })
    .meta({ id: 'ListSecretsResponse' });
