

export interface IntegrationConfigurationBase<TIntegration extends SupportedIntegrations = SupportedIntegrations> {
    integration: TIntegration;
    enabled: boolean;
}

export interface GladiaConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.gladia> {
    api_key?: string;
    has_api_key?: boolean;
    api_key_hint?: string;
    url?: string;
}


export interface GithubConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.github> {
    allowed_repositories: string[];
}

export interface AwsConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.aws> {
    s3_role_arn: string;
}

export interface MagicPdfConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.magic_pdf> {
    // No additional configuration
    default_features?: string[];
    default_zones?: string[];
}

export interface SerperConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.serper> {
    api_key?: string;
    has_api_key?: boolean;
    api_key_hint?: string;
    url?: string;
}

export interface ExaConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.exa> {
    api_key?: string;
    has_api_key?: boolean;
    api_key_hint?: string;
}

export interface LinkupConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.linkup> {
    api_key?: string;
    has_api_key?: boolean;
    api_key_hint?: string;
}

export interface ResendConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.resend> {
    /** Resend API key for sending emails */
    api_key?: string;
    has_api_key?: boolean;
    api_key_hint?: string;
    /** Domain for email (both sending and receiving). Must be verified in Resend. */
    email_domain: string;
    /** Default display name for outgoing emails (e.g., "Vertesia - Project Name") */
    default_from_name?: string;
    /** Webhook secret for validating inbound email webhooks (required for receiving emails) */
    webhook_secret?: string;
    has_webhook_secret?: boolean;
    webhook_secret_hint?: string;
    /** Domains allowed to send emails TO start agents (for inbound validation) */
    allowed_sender_domains?: string[];
    /** Require sender to have project access to start agents via email (default: true) */
    require_project_access?: boolean;
    /** Require DKIM/SPF authentication to pass for inbound emails (default: true) */
    require_email_auth?: boolean;
}

/**
 * Configuration for ask_user webhook notifications.
 * Sends webhooks when agents call ask_user and when users respond.
 */
export interface AskUserWebhookConfiguration extends IntegrationConfigurationBase<SupportedIntegrations.ask_user_webhook> {
    /** Webhook URL to receive ask_user events */
    webhook_url: string;
    /** Secret for signing webhook payloads (HMAC-SHA256) */
    webhook_secret?: string;
    has_webhook_secret?: boolean;
    webhook_secret_hint?: string;
    /** Which events to send: ['requested', 'resolved'] or subset (default: both) */
    events?: ('requested' | 'resolved')[];
    /** Custom headers to include in webhook requests */
    custom_headers?: Record<string, string>;
}

export enum SupportedIntegrations {
    gladia = "gladia",
    github = "github",
    aws = "aws",
    magic_pdf = "magic_pdf",
    serper = "serper",
    exa = "exa",
    linkup = "linkup",
    resend = "resend",
    ask_user_webhook = "ask_user_webhook",
}

/**
 * @discriminator integration
 */
export type ProjectIntegrationConfig =
    | GladiaConfiguration
    | GithubConfiguration
    | AwsConfiguration
    | MagicPdfConfiguration
    | SerperConfiguration
    | ExaConfiguration
    | LinkupConfiguration
    | ResendConfiguration
    | AskUserWebhookConfiguration;

export function withProjectIntegrationDiscriminator(
    integration: SupportedIntegrations,
    config: Record<string, unknown>,
): ProjectIntegrationConfig {
    return {
        ...config,
        integration,
    } as ProjectIntegrationConfig;
}
