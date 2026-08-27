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
} from './api-schemas/integrations.js';

export type GladiaConfigurationInput = z.infer<typeof GladiaConfigurationInputSchema>;

export type GladiaConfiguration = z.infer<typeof GladiaConfigurationSchema>;

export interface GladiaConfigurationWithSecrets extends GladiaConfiguration {
    api_key: string | null;
}

export type GithubConfigurationInput = z.infer<typeof GithubConfigurationInputSchema>;

export type GithubConfiguration = z.infer<typeof GithubConfigurationSchema>;

export type AwsConfiguration = z.infer<typeof AwsConfigurationSchema>;

export type MagicPdfConfiguration = z.infer<typeof MagicPdfConfigurationSchema>;

export type SerperConfigurationInput = z.infer<typeof SerperConfigurationInputSchema>;

export type SerperConfiguration = z.infer<typeof SerperConfigurationSchema>;

export type ExaConfigurationInput = z.infer<typeof ExaConfigurationInputSchema>;

export type ExaConfiguration = z.infer<typeof ExaConfigurationSchema>;

export type LinkupConfigurationInput = z.infer<typeof LinkupConfigurationInputSchema>;

export type LinkupConfiguration = z.infer<typeof LinkupConfigurationSchema>;

export type ResendConfigurationInput = z.infer<typeof ResendConfigurationInputSchema>;

export type ResendConfiguration = z.infer<typeof ResendConfigurationSchema>;

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
