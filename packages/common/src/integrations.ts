import type { z } from 'zod';
import type {
    AskUserWebhookConfigurationInputSchema,
    AskUserWebhookConfigurationSchema,
    AwsConfigurationSchema,
    ExaConfigurationInputSchema,
    ExaConfigurationSchema,
    GithubConfigurationInputSchema,
    GithubConfigurationSchema,
    GladiaConfigurationInputSchema,
    GladiaConfigurationSchema,
    LinkupConfigurationInputSchema,
    LinkupConfigurationSchema,
    MagicPdfConfigurationSchema,
    ProjectIntegrationConfigRequestSchema,
    ProjectIntegrationConfigResponseSchema,
    ResendConfigurationInputSchema,
    ResendConfigurationSchema,
    SerperConfigurationInputSchema,
    SerperConfigurationSchema,
} from './api-schemas/studio-remaining.js';
export interface IntegrationConfigurationBase<TIntegration extends SupportedIntegrations = SupportedIntegrations> {
    integration: TIntegration;
    enabled: boolean;
}

export type GladiaConfigurationInput = z.infer<typeof GladiaConfigurationInputSchema>;

export type GladiaConfiguration = z.infer<typeof GladiaConfigurationSchema>;

export interface GladiaConfigurationWithSecrets extends GladiaConfiguration {
    api_key?: string;
}

export type GithubConfigurationInput = z.infer<typeof GithubConfigurationInputSchema>;

export type GithubConfiguration = z.infer<typeof GithubConfigurationSchema>;

export type AwsConfiguration = z.infer<typeof AwsConfigurationSchema>;

export type MagicPdfConfiguration = z.infer<typeof MagicPdfConfigurationSchema>;

export type SerperConfigurationInput = z.infer<typeof SerperConfigurationInputSchema>;

export type SerperConfiguration = z.infer<typeof SerperConfigurationSchema>;

export interface SerperConfigurationWithSecrets extends SerperConfiguration {
    api_key?: string;
}

export type ExaConfigurationInput = z.infer<typeof ExaConfigurationInputSchema>;

export type ExaConfiguration = z.infer<typeof ExaConfigurationSchema>;

export interface ExaConfigurationWithSecrets extends ExaConfiguration {
    api_key?: string;
}

export type LinkupConfigurationInput = z.infer<typeof LinkupConfigurationInputSchema>;

export type LinkupConfiguration = z.infer<typeof LinkupConfigurationSchema>;

export interface LinkupConfigurationWithSecrets extends LinkupConfiguration {
    api_key?: string;
}

export type ResendConfigurationInput = z.infer<typeof ResendConfigurationInputSchema>;

export type ResendConfiguration = z.infer<typeof ResendConfigurationSchema>;

export interface ResendConfigurationWithSecrets extends ResendConfiguration {
    /** Resend API key for sending emails */
    api_key?: string;
    /** Webhook secret for validating inbound email webhooks (required for receiving emails) */
    webhook_secret?: string;
}

/**
 * Configuration for ask_user webhook notifications.
 * Sends webhooks when agents call ask_user and when users respond.
 */
export type AskUserWebhookConfigurationInput = z.infer<typeof AskUserWebhookConfigurationInputSchema>;

/**
 * Configuration for ask_user webhook notifications.
 * Sends webhooks when agents call ask_user and when users respond.
 */
export type AskUserWebhookConfiguration = z.infer<typeof AskUserWebhookConfigurationSchema>;

export interface AskUserWebhookConfigurationWithSecrets extends AskUserWebhookConfiguration {
    /** Secret for signing webhook payloads (HMAC-SHA256) */
    webhook_secret?: string;
}

export enum SupportedIntegrations {
    gladia = 'gladia',
    github = 'github',
    aws = 'aws',
    magic_pdf = 'magic_pdf',
    serper = 'serper',
    exa = 'exa',
    linkup = 'linkup',
    resend = 'resend',
    ask_user_webhook = 'ask_user_webhook',
}

/**
 * @discriminator integration
 */
export type ProjectIntegrationConfigRequest = z.infer<typeof ProjectIntegrationConfigRequestSchema>;

/**
 * @discriminator integration
 */
export type ProjectIntegrationConfigResponse = z.infer<typeof ProjectIntegrationConfigResponseSchema>;

export type ProjectIntegrationConfigWithSecrets =
    | GladiaConfigurationWithSecrets
    | GithubConfiguration
    | AwsConfiguration
    | MagicPdfConfiguration
    | SerperConfigurationWithSecrets
    | ExaConfigurationWithSecrets
    | LinkupConfigurationWithSecrets
    | ResendConfigurationWithSecrets
    | AskUserWebhookConfigurationWithSecrets;

export type ProjectIntegrationConfig = ProjectIntegrationConfigResponse;

export function withProjectIntegrationDiscriminator(
    integration: SupportedIntegrations,
    config: Record<string, unknown>,
): ProjectIntegrationConfigResponse {
    return {
        ...config,
        integration,
    } as ProjectIntegrationConfigResponse;
}
