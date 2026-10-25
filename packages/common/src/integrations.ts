import type * as Wire from './wire-types.generated.js';

export type GladiaConfigurationInput = Wire.GladiaConfigurationInput;

export type GladiaConfiguration = Wire.GladiaConfiguration;

export interface GladiaConfigurationWithSecrets extends GladiaConfiguration {
    api_key: string | null;
}

export type GithubConfigurationInput = Wire.GithubConfigurationInput;

export type GithubConfiguration = Wire.GithubConfiguration;

export type AwsConfiguration = Wire.AwsConfiguration;

export type MagicPdfConfiguration = Wire.MagicPdfConfiguration;

export type SerperConfigurationInput = Wire.SerperConfigurationInput;

export type SerperConfiguration = Wire.SerperConfiguration;

export type ExaConfigurationInput = Wire.ExaConfigurationInput;

export type ExaConfiguration = Wire.ExaConfiguration;

export type LinkupConfigurationInput = Wire.LinkupConfigurationInput;

export type LinkupConfiguration = Wire.LinkupConfiguration;

export type ResendConfigurationInput = Wire.ResendConfigurationInput;

export type ResendConfiguration = Wire.ResendConfiguration;

/**
 * Configuration for ask_user webhook notifications.
 * Sends webhooks when agents call ask_user and when users respond.
 */
export type AskUserWebhookConfigurationInput = Wire.AskUserWebhookConfigurationInput;

/**
 * Configuration for ask_user webhook notifications.
 * Sends webhooks when agents call ask_user and when users respond.
 */
export type AskUserWebhookConfiguration = Wire.AskUserWebhookConfiguration;

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
export type ProjectIntegrationConfigRequest = Wire.ProjectIntegrationConfigRequest;

/**
 * @discriminator integration
 */
export type ProjectIntegrationConfigResponse = Wire.ProjectIntegrationConfigResponse;
