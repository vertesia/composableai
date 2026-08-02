import { z } from 'zod';
import { SystemRolesSchema } from './apikey.js';

const ALGORITHM_DESCRIPTION = 'Signing algorithm - defaults to ES256. Use RS256 for Azure AD compatibility.';

export const TokenTypeSchema = z.enum(['apikey', 'user', 'project', 'environment', 'agent', 'service_account']);

export const SigningAlgorithmSchema = z.enum(['ES256', 'RS256']).meta({ id: 'SigningAlgorithm' });

const baseTokenRequestShape = {
    audience: z.string().optional(),
    algorithm: SigningAlgorithmSchema.meta({ description: ALGORITHM_DESCRIPTION }).optional(),
};

export const ApiKeyTokenRequestSchema = z
    .strictObject({
        type: z.literal('apikey'),
        ...baseTokenRequestShape,
        key: z.string(),
    })
    .meta({ id: 'ApiKeyTokenRequest', required: ['key', 'type'] });

export const UserTokenRequestSchema = z
    .strictObject({
        type: z.literal('user'),
        ...baseTokenRequestShape,
        user_id: z.string().optional(),
        account_id: z.string().optional(),
        project_id: z.string().optional(),
        expires_at: z.number().optional(),
        on_behalf_of: z.string().optional(),
    })
    .meta({ id: 'UserTokenRequest' });

export const ProjectTokenRequestSchema = z
    .strictObject({
        type: z.literal('project'),
        ...baseTokenRequestShape,
        project_id: z.string(),
        account_id: z.string(),
    })
    .meta({ id: 'ProjectTokenRequest', required: ['account_id', 'project_id', 'type'] });

export const EnvironmentTokenRequestSchema = z
    .strictObject({
        type: z.literal('environment'),
        ...baseTokenRequestShape,
        environment_id: z.string(),
        environment_name: z.string(),
        project_id: z.string(),
        account_id: z.string(),
    })
    .meta({
        id: 'EnvironmentTokenRequest',
        required: ['account_id', 'environment_id', 'environment_name', 'project_id', 'type'],
    });

export const AgentTokenRequestSchema = z
    .strictObject({
        type: z.literal('agent'),
        ...baseTokenRequestShape,
        account_id: z.string(),
        project_id: z.string(),
        name: z.string().optional(),
        on_behalf_of: z.string().meta({
            description:
                'User information.\n\nThe value of this field can be either:   - a signed Vertesia token used to verify the user context   - a user ID prefixed with `user:` to indicate the user on behalf of whom the agent is     acting.',
        }),
    })
    .meta({
        id: 'AgentTokenRequest',
        required: ['account_id', 'on_behalf_of', 'project_id', 'type'],
        description:
            'Agent token for a service account to act as agent on behalf of a user.\n\nTwo trust paths are supported:\n\n- `user_access_token`: a live signed Vertesia token. STS verifies the user context from that token.\n- `workload_id_token`: a workload acts on behalf of a user. It implies that a full verification   will be performed based on the workload identity.',
    });

export const ServiceAccountTokenRequestSchema = z
    .strictObject({
        type: z.literal('service_account'),
        ...baseTokenRequestShape,
        account_id: z.string(),
        project_id: z.string(),
        roles: z.array(SystemRolesSchema).optional(),
        name: z.string().optional(),
        email: z.string().optional(),
    })
    .meta({ id: 'ServiceAccountTokenRequest', required: ['account_id', 'project_id', 'type'] });

export const IssueTokenRequestSchema = z
    .discriminatedUnion('type', [
        ApiKeyTokenRequestSchema,
        UserTokenRequestSchema,
        ProjectTokenRequestSchema,
        EnvironmentTokenRequestSchema,
        AgentTokenRequestSchema,
        ServiceAccountTokenRequestSchema,
    ])
    .meta({ id: 'IssueTokenRequest' });

export const IssueTokenResponseSchema = z
    .strictObject({
        token: z.string(),
        token_type: z.literal('Bearer'),
        expires_in: z.number().optional(),
    })
    .meta({ id: 'IssueTokenResponse' });

export const IssueTokenUnavailableResponseSchema = z
    .strictObject({ error: z.string(), message: z.string() })
    .meta({ id: 'error_string_message_string' });
