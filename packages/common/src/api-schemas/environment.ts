import { AIModelSchema, TextFallbackOptionsSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import { SupportedProviders } from '../environment.js';
import { StringValueMapSchema } from './files.js';

/**
 * Execution environments — the provider connections the studio executes interactions against.
 *
 * The provider vocabulary is the one place this file does not spell a list out: `SupportedProviders`
 * is llumiverse's `Providers` merged with the three studio-only virtual providers, and it is a value
 * (a `const` object) as well as a type, so `z.enum()` reads the members off it. Adding a provider on
 * either side reaches the document without anything here changing.
 */

export const SupportedProvidersSchema = z.enum(SupportedProviders).meta({ id: 'SupportedProviders' });

export const VirtualEnvEntrySchema = z.strictObject({ model: z.string() }).meta({ id: 'VirtualEnvEntry' });

export const LoadBalancingEnvEntryConfigSchema = z
    .strictObject({
        model: z.string(),
        weight: z.number(),
    })
    .meta({ id: 'LoadBalancingEnvEntryConfig' });

export const LoadBalancingEnvConfigSchema = z
    .strictObject({
        entries: z.array(LoadBalancingEnvEntryConfigSchema).optional(),
        failover: z.boolean().optional(),
    })
    .meta({ id: 'LoadBalancingEnvConfig', description: 'Custom configuration for virtual environments' });

export const MediatorEnvConfigSchema = z
    .strictObject({
        entries: z.array(VirtualEnvEntrySchema).optional(),
        max_concurrent_requests: z.number().optional(),
        // The model used to evaluate the responses. If not specified all entries mediate the
        // response and the best one is picked.
        mediators: z.array(VirtualEnvEntrySchema).optional(),
        model_options: TextFallbackOptionsSchema.optional(),
    })
    .meta({ id: 'MediatorEnvConfig' });

/**
 * `z.object().catchall()`, not `strictObject`: the component publishes `additionalProperties: {}`,
 * because the interface carried an index signature. Driver-specific settings are passed straight
 * through, so an environment for a provider this build has never heard of still round-trips.
 */
export const ExecutionEnvironmentSettingsSchema = z
    .object({
        bucket_access_principal: z.string().optional(),
        default_headers: StringValueMapSchema.meta({
            description: 'Custom HTTP headers sent by OpenAI-compatible environments.',
        }).optional(),
    })
    .catchall(z.unknown())
    .meta({ id: 'ExecutionEnvironmentSettings' });

const environmentSettingsDescription =
    'Additional provider-specific settings passed through to the driver. For example, custom ' +
    'headers for Apigee-proxied endpoints.';

/**
 * The fields a caller may both send and read back. Create adds nothing; update makes them all
 * optional; the read shape adds the server-owned identity and audit fields.
 */
const environmentWritableFields = {
    name: z.string(),
    provider: SupportedProvidersSchema,
    description: z.string().optional(),
    endpoint_url: z.string().optional(),
    default_model: z.string().optional(),
    enabled_models: z.array(AIModelSchema).optional(),
    /**
     * On the way in, the provider credential in clear. On the way out it is the MASKED value —
     * `apikey_hint` when one is stored, otherwise the key with its middle replaced — so this is not
     * a second name for a secret the read shape leaks. See `toEnvironmentResponse` in studio-server.
     */
    apiKey: z.string().optional(),
    config: z.unknown().optional(),
    settings: ExecutionEnvironmentSettingsSchema.meta({ description: environmentSettingsDescription }).optional(),
    allowed_projects: z.array(z.string()).optional(),
};

export const ExecutionEnvironmentCreatePayloadSchema = z
    .strictObject(environmentWritableFields)
    .meta({ id: 'ExecutionEnvironmentCreatePayload' });

export const ExecutionEnvironmentUpdatePayloadSchema = z
    .strictObject(environmentWritableFields)
    .partial()
    .meta({ id: 'ExecutionEnvironmentUpdatePayload' });

export const ExecutionEnvironmentSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        provider: SupportedProvidersSchema,
        description: z.string().optional(),
        endpoint_url: z.string().optional(),
        default_model: z.string().optional(),
        enabled_models: z.array(AIModelSchema).optional(),
        apiKey: z.string().optional(),
        apikey_hint: z
            .string()
            .meta({
                description:
                    'Hint showing first and last characters of the API key (e.g. "AKIA...3xQf"). Stored ' +
                    'alongside the encrypted key so the UI can display which key is configured.',
            })
            .optional(),
        config: z.unknown().optional(),
        settings: ExecutionEnvironmentSettingsSchema.meta({ description: environmentSettingsDescription }).optional(),
        account: z.string(),
        allowed_projects: z.array(z.string()).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'ExecutionEnvironment' });

export const ExecutionEnvironmentArraySchema = z
    .array(ExecutionEnvironmentSchema)
    .meta({ id: 'ExecutionEnvironmentArray' });

/**
 * The environment as an interaction's resolution result sees it — same fields as
 * {@link ExecutionEnvironmentSchema} minus the secret (`apiKey`, `apikey_hint`) and the
 * provider-specific `config`/`settings` blocks.
 *
 * No environment endpoint returns it; it has a component because `ResolvedInteractionExecutionInfo`
 * refs it, and a canonical component may not `$ref` a TypeScript-derived one.
 */
export const ExecutionEnvironmentRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        provider: SupportedProvidersSchema,
        enabled_models: z.array(AIModelSchema).optional(),
        default_model: z.string().optional(),
        endpoint_url: z.string().optional(),
        allowed_projects: z.array(z.string()).optional(),
        account: z.string(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
    })
    .meta({ id: 'ExecutionEnvironmentRef' });

export const MigrateInteractionsPayloadSchema = z
    .strictObject({
        new_env_id: z.string().meta({ description: 'The new environment ID to set on the interactions.' }),
        new_model_id: z.string().meta({ description: 'The new model ID to set on the interactions.' }),
        interaction_ids: z
            .array(z.string())
            .meta({ description: 'Draft interaction IDs to migrate to the new environment and model.' }),
    })
    .meta({ id: 'MigrateInteractionsPayload' });

export const MigrateInteractionsResultSchema = z
    .strictObject({
        matched_count: z.number(),
        modified_count: z.number(),
    })
    .meta({ id: 'MigrateInteractionsResult' });

export const ExecutionEnvironmentConfigUpdatePayloadSchema = z
    .strictObject({
        enabled_models: z.array(AIModelSchema).optional(),
        config: z.union([MediatorEnvConfigSchema, LoadBalancingEnvConfigSchema]).optional(),
    })
    .meta({ id: 'ExecutionEnvironmentConfigUpdatePayload' });

export const EnableEnvironmentModelPayloadSchema = z
    .strictObject({
        model_id: z
            .string()
            .meta({ description: "Provider model ID to resolve from the environment's available model listing." }),
    })
    .meta({ id: 'EnableEnvironmentModelPayload' });

/**
 * `GET /environments`. Not published as a component body — a query schema is expanded into
 * parameters — so `?all=true` reaches the document as one boolean parameter.
 */
export const ListEnvironmentsQuerySchema = z
    .strictObject({ all: z.boolean().optional() })
    .meta({ id: 'ListEnvironmentsQuery' });
