// Runtime schemas for the integrations API domain.

import { z } from 'zod';
import { SupportedIntegrations } from '../integrations.js';
import { StringValueMapSchema } from './files.js';
import { DSLActivityOptionsSchema } from './process.js';

const agentOnlyDecryptedSecretSchema = z.string().meta({
    description:
        'Decrypted credential returned only to authenticated agent principals for runtime use. Human and service-account callers receive null; presence and hint fields report configuration status.',
});

export const SupportedIntegrations_ask_user_webhookSchema = z
    .literal(SupportedIntegrations.ask_user_webhook)
    .meta({ id: 'SupportedIntegrations_ask_user_webhook' });

export const SupportedIntegrations_resendSchema = z
    .literal(SupportedIntegrations.resend)
    .meta({ id: 'SupportedIntegrations_resend' });

export const SupportedIntegrations_linkupSchema = z
    .literal(SupportedIntegrations.linkup)
    .meta({ id: 'SupportedIntegrations_linkup' });

export const SupportedIntegrations_exaSchema = z
    .literal(SupportedIntegrations.exa)
    .meta({ id: 'SupportedIntegrations_exa' });

export const SupportedIntegrations_serperSchema = z
    .literal(SupportedIntegrations.serper)
    .meta({ id: 'SupportedIntegrations_serper' });

export const SupportedIntegrations_magic_pdfSchema = z
    .literal(SupportedIntegrations.magic_pdf)
    .meta({ id: 'SupportedIntegrations_magic_pdf' });

export const SupportedIntegrations_awsSchema = z
    .literal(SupportedIntegrations.aws)
    .meta({ id: 'SupportedIntegrations_aws' });

export const SupportedIntegrations_githubSchema = z
    .literal(SupportedIntegrations.github)
    .meta({ id: 'SupportedIntegrations_github' });

export const SupportedIntegrations_gladiaSchema = z
    .literal(SupportedIntegrations.gladia)
    .meta({ id: 'SupportedIntegrations_gladia' });

export const AskUserWebhookConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_ask_user_webhookSchema,
        enabled: z.boolean(),
        // Optional on the RESPONSE only — `AskUserWebhookConfigurationInputSchema` still requires it,
        // because you cannot configure the integration without one. `getIntegrationConfig` reads
        // `integrations?.[integrationId] ?? {}`, so a project that never set this integration up
        // legitimately answers with the discriminator and `enabled` alone, and a required
        // `webhook_url` made that answer fail its own response contract on every call. Same defect
        // and same fix as `AwsConfiguration.s3_role_arn`.
        webhook_url: z.string().meta({ description: 'Webhook URL to receive ask_user events' }).optional(),
        has_webhook_secret: z.boolean().optional(),
        webhook_secret_hint: z.string().optional(),
        webhook_secret: agentOnlyDecryptedSecretSchema.nullable(),
        events: z
            .array(z.enum(['requested', 'resolved']))
            .meta({ description: "Which events to send: ['requested', 'resolved'] or subset (default: both)" })
            .optional(),
        custom_headers: StringValueMapSchema.meta({
            description: 'Custom headers to include in webhook requests',
        }).optional(),
    })
    .meta({
        id: 'AskUserWebhookConfiguration',
        description:
            'Configuration for ask_user webhook notifications. Sends webhooks when agents call ask_user and when users respond.',
    });

export const ResendConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_resendSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        api_key: agentOnlyDecryptedSecretSchema.nullable(),
        email_domain: z
            .string()
            .meta({ description: 'Domain for email (both sending and receiving). Must be verified in Resend.' }),
        default_from_name: z
            .string()
            .meta({ description: 'Default display name for outgoing emails (e.g., "Vertesia - Project Name")' })
            .optional(),
        has_webhook_secret: z.boolean().optional(),
        webhook_secret_hint: z.string().optional(),
        webhook_secret: agentOnlyDecryptedSecretSchema.nullable(),
        allowed_sender_domains: z
            .array(z.string())
            .meta({ description: 'Domains allowed to send emails TO start agents (for inbound validation)' })
            .optional(),
        require_project_access: z
            .boolean()
            .meta({ description: 'Require sender to have project access to start agents via email (default: true)' })
            .optional(),
        require_email_auth: z
            .boolean()
            .meta({ description: 'Require DKIM/SPF authentication to pass for inbound emails (default: true)' })
            .optional(),
    })
    .meta({ id: 'ResendConfiguration' });

export const LinkupConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_linkupSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        api_key: agentOnlyDecryptedSecretSchema.nullable(),
    })
    .meta({ id: 'LinkupConfiguration' });

export const ExaConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_exaSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        api_key: agentOnlyDecryptedSecretSchema.nullable(),
    })
    .meta({ id: 'ExaConfiguration' });

export const SerperConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_serperSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        api_key: agentOnlyDecryptedSecretSchema.nullable(),
        url: z.string().optional(),
    })
    .meta({ id: 'SerperConfiguration' });

export const GithubConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_githubSchema,
        enabled: z.boolean(),
        github_app_id: z
            .string()
            .meta({ description: 'Numeric GitHub App id used to mint installation tokens (non-secret).' })
            .optional(),
        allowed_repositories: z.array(z.string()),
        has_github_app_private_key: z
            .boolean()
            .meta({
                description:
                    'True when a GitHub App private key is stored for the project (the key itself is never returned).',
            })
            .optional(),
    })
    .meta({ id: 'GithubConfiguration' });

export const GladiaConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_gladiaSchema,
        enabled: z.boolean(),
        has_api_key: z.boolean().optional(),
        api_key_hint: z.string().optional(),
        api_key: agentOnlyDecryptedSecretSchema.nullable(),
        url: z.string().optional(),
    })
    .meta({ id: 'GladiaConfiguration' });

export const RemoteActivityDefinitionSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Activity name (snake_case, unique within the collection)' }),
        collection: z.string().meta({ description: 'Collection name this activity belongs to' }).optional(),
        title: z.string().meta({ description: 'Display title' }).optional(),
        description: z.string().meta({ description: 'Description of what the activity does' }).optional(),
        input_schema: z
            .looseObject({})
            .meta({ description: 'JSON Schema for the activity input parameters' })
            .optional(),
        output_schema: z.looseObject({}).meta({ description: 'JSON Schema for the activity output' }).optional(),
        url: z
            .string()
            .meta({
                description:
                    'The activity execution URL. Can be absolute or relative to the tool server base URL. If not provided, the collection-specific activities endpoint is used.',
            })
            .optional(),
        options: DSLActivityOptionsSchema.meta({ description: 'Suggested timeout and retry configuration' }).optional(),
    })
    .meta({
        id: 'RemoteActivityDefinition',
        description:
            'Definition of a remote activity exposed by a tool server for use in DSL workflows. Remote activities are identified in workflow steps using colon-separated names: `app:<app_name>:<collection>:<activity_name>` (e.g. `app:my-nlp-app:examples:word_count`).',
    });

export const AskUserWebhookConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_ask_user_webhookSchema,
        enabled: z.boolean(),
        webhook_url: z.string().meta({ description: 'Webhook URL to receive ask_user events' }),
        webhook_secret: z
            .string()
            .meta({ description: 'Secret for signing webhook payloads (HMAC-SHA256)' })
            .optional(),
        events: z
            .array(z.enum(['requested', 'resolved']))
            .meta({ description: "Which events to send: ['requested', 'resolved'] or subset (default: both)" })
            .optional(),
        custom_headers: StringValueMapSchema.meta({
            description: 'Custom headers to include in webhook requests',
        }).optional(),
    })
    .meta({
        id: 'AskUserWebhookConfigurationInput',
        description:
            'Configuration for ask_user webhook notifications. Sends webhooks when agents call ask_user and when users respond.',
    });

export const ResendConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_resendSchema,
        enabled: z.boolean(),
        api_key: z.string().meta({ description: 'Resend API key for sending emails' }).optional(),
        email_domain: z
            .string()
            .meta({ description: 'Domain for email (both sending and receiving). Must be verified in Resend.' }),
        default_from_name: z
            .string()
            .meta({ description: 'Default display name for outgoing emails (e.g., "Vertesia - Project Name")' })
            .optional(),
        webhook_secret: z
            .string()
            .meta({
                description: 'Webhook secret for validating inbound email webhooks (required for receiving emails)',
            })
            .optional(),
        allowed_sender_domains: z
            .array(z.string())
            .meta({ description: 'Domains allowed to send emails TO start agents (for inbound validation)' })
            .optional(),
        require_project_access: z
            .boolean()
            .meta({ description: 'Require sender to have project access to start agents via email (default: true)' })
            .optional(),
        require_email_auth: z
            .boolean()
            .meta({ description: 'Require DKIM/SPF authentication to pass for inbound emails (default: true)' })
            .optional(),
    })
    .meta({ id: 'ResendConfigurationInput' });

export const LinkupConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_linkupSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
    })
    .meta({ id: 'LinkupConfigurationInput' });

export const ExaConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_exaSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
    })
    .meta({ id: 'ExaConfigurationInput' });

export const SerperConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_serperSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'SerperConfigurationInput' });

export const MagicPdfConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_magic_pdfSchema,
        enabled: z.boolean(),
        default_features: z.array(z.string()).optional(),
        default_zones: z.array(z.string()).optional(),
    })
    .meta({ id: 'MagicPdfConfiguration' });

export const AwsConfigurationSchema = z
    .strictObject({
        integration: SupportedIntegrations_awsSchema,
        enabled: z.boolean(),
        // Optional because "declared but not configured" is a real state, not legacy data:
        // `getIntegrationConfig` reads `integrations?.[integrationId] ?? {}`, so a project that has
        // never set up AWS answers `{ integration: 'aws', enabled: false }` with no role ARN at all.
        // Requiring it here made that answer fail its own response contract. The consumers already
        // agree it is optional — the server guards on `s3_role_arn` being present before assuming a
        // role, and every sibling integration marks its config fields optional for the same reason
        // (`github_app_id`, `url`, ...).
        s3_role_arn: z.string().optional(),
    })
    .meta({ id: 'AwsConfiguration' });

export const GithubConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_githubSchema,
        enabled: z.boolean(),
        github_app_id: z
            .string()
            .meta({ description: 'Numeric GitHub App id used to mint installation tokens (non-secret).' })
            .optional(),
        allowed_repositories: z
            .array(z.string())
            .meta({
                description:
                    'Allow-list of `owner/name` repos the bot may mint installation tokens for (default-deny when empty).',
            })
            .optional(),
        private_key: z
            .string()
            .meta({ description: 'GitHub App private key (PEM). Write-only; never returned. Empty string clears it.' })
            .optional(),
    })
    .meta({ id: 'GithubConfigurationInput' });

export const GladiaConfigurationInputSchema = z
    .strictObject({
        integration: SupportedIntegrations_gladiaSchema,
        enabled: z.boolean(),
        api_key: z.string().optional(),
        url: z.string().optional(),
    })
    .meta({ id: 'GladiaConfigurationInput' });

export const ProjectIntegrationConfigResponseSchema = z
    .discriminatedUnion('integration', [
        GladiaConfigurationSchema,
        GithubConfigurationSchema,
        AwsConfigurationSchema,
        MagicPdfConfigurationSchema,
        SerperConfigurationSchema,
        ExaConfigurationSchema,
        LinkupConfigurationSchema,
        ResendConfigurationSchema,
        AskUserWebhookConfigurationSchema,
    ])
    .meta({
        id: 'ProjectIntegrationConfigResponse',
        type: 'object',
        required: ['integration'],
        discriminator: {
            propertyName: 'integration',
            mapping: {
                ask_user_webhook: '#/components/schemas/AskUserWebhookConfiguration',
                aws: '#/components/schemas/AwsConfiguration',
                exa: '#/components/schemas/ExaConfiguration',
                github: '#/components/schemas/GithubConfiguration',
                gladia: '#/components/schemas/GladiaConfiguration',
                linkup: '#/components/schemas/LinkupConfiguration',
                magic_pdf: '#/components/schemas/MagicPdfConfiguration',
                resend: '#/components/schemas/ResendConfiguration',
                serper: '#/components/schemas/SerperConfiguration',
            },
        },
    });

export const ProjectIntegrationConfigRequestSchema = z
    .discriminatedUnion('integration', [
        GladiaConfigurationInputSchema,
        GithubConfigurationInputSchema,
        AwsConfigurationSchema,
        MagicPdfConfigurationSchema,
        SerperConfigurationInputSchema,
        ExaConfigurationInputSchema,
        LinkupConfigurationInputSchema,
        ResendConfigurationInputSchema,
        AskUserWebhookConfigurationInputSchema,
    ])
    .meta({
        id: 'ProjectIntegrationConfigRequest',
        type: 'object',
        required: ['integration'],
        discriminator: {
            propertyName: 'integration',
            mapping: {
                ask_user_webhook: '#/components/schemas/AskUserWebhookConfigurationInput',
                aws: '#/components/schemas/AwsConfiguration',
                exa: '#/components/schemas/ExaConfigurationInput',
                github: '#/components/schemas/GithubConfigurationInput',
                gladia: '#/components/schemas/GladiaConfigurationInput',
                linkup: '#/components/schemas/LinkupConfigurationInput',
                magic_pdf: '#/components/schemas/MagicPdfConfiguration',
                resend: '#/components/schemas/ResendConfigurationInput',
                serper: '#/components/schemas/SerperConfigurationInput',
            },
        },
    });
