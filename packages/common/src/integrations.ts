

export interface IntegrationConfigurationBase {
    enabled: boolean;
}

export interface GladiaConfiguration extends IntegrationConfigurationBase {
    api_key: string;
    url?: string;
}


export interface GithubConfiguration extends IntegrationConfigurationBase {
    allowed_repositories: string[];
}

export interface AwsConfiguration extends IntegrationConfigurationBase {
    s3_role_arn: string;
}

export interface MagicPdfConfiguration extends IntegrationConfigurationBase {
    // No additional configuration
    default_features?: string[];
    default_zones?: string[];
}

export interface SerperConfiguration extends IntegrationConfigurationBase {
    api_key: string;
    url?: string;
}

export interface ExaConfiguration extends IntegrationConfigurationBase {
    api_key: string;
}

export interface LinkupConfiguration extends IntegrationConfigurationBase {
    api_key: string;
}

export interface ResendConfiguration extends IntegrationConfigurationBase {
    /** Resend API key for sending emails */
    api_key: string;
    /** Domain for email (both sending and receiving). Must be verified in Resend. */
    email_domain: string;
    /** Default display name for outgoing emails (e.g., "Vertesia - Project Name") */
    default_from_name?: string;
    /** Webhook secret for validating inbound email webhooks (required for receiving emails) */
    webhook_secret: string;
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
export interface AskUserWebhookConfiguration extends IntegrationConfigurationBase {
    /** Webhook URL to receive ask_user events */
    webhook_url: string;
    /** Secret for signing webhook payloads (HMAC-SHA256) */
    webhook_secret?: string;
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