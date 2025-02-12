

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

export interface MacgicPdfConfiguration extends IntegrationConfigurationBase {
    // No additional configuration
}

export enum SupportedIntegrations {
    gladia = "gladia",
    github = "github",
    aws = "aws",
    magic_pdf = "magic_pdf",
}