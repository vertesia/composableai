

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

export interface ResendConfiguration extends IntegrationConfigurationBase {
    /** Resend API key for sending emails */
    api_key: string;
    /** Domain for inbound email routing (e.g., inbound.vertesia.io) */
    inbound_domain: string;
    /** Webhook secret for validating inbound email webhooks */
    webhook_secret?: string;
    /** Domains allowed to send emails TO start agents (for inbound validation) */
    allowed_sender_domains?: string[];
}

export enum SupportedIntegrations {
    gladia = "gladia",
    github = "github",
    aws = "aws",
    magic_pdf = "magic_pdf",
    serper = "serper",
    resend = "resend",
}