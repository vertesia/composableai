import type { ProviderParams } from '@llumiverse/common';
import { ProviderList, Providers } from '@llumiverse/common';
import type { z } from 'zod';
import type {
    EnableEnvironmentModelPayloadSchema,
    ExecutionEnvironmentConfigUpdatePayloadSchema,
    ExecutionEnvironmentCreatePayloadSchema,
    ExecutionEnvironmentRefSchema,
    ExecutionEnvironmentSchema,
    ExecutionEnvironmentSettingsSchema,
    ExecutionEnvironmentUpdatePayloadSchema,
    ListEnvironmentsQuerySchema,
    LoadBalancingEnvConfigSchema,
    LoadBalancingEnvEntryConfigSchema,
    MediatorEnvConfigSchema,
    MigrateInteractionsPayloadSchema,
    MigrateInteractionsResultSchema,
    SupportedProvidersSchema,
    VirtualEnvEntrySchema,
} from './api-schemas/environment.js';

// Virtual providers from studio
export enum CustomProviders {
    virtual_lb = 'virtual_lb',
    virtual_mediator = 'virtual_mediator',
    test = 'test',
}

// The const and the type are one declaration in two halves: the object is what `z.enum()` reads the
// members off, and the type is inferred back from that schema rather than restated as
// `Providers | CustomProviders` — which is the same union, but a second statement of it.
export const SupportedProviders = {
    ...Providers,
    ...CustomProviders,
} as const;

export type SupportedProviders = z.infer<typeof SupportedProvidersSchema>;

export interface SupportedProviderParams extends Omit<ProviderParams, 'id'> {
    id: SupportedProviders;
}

export const CustomProvidersList: Record<CustomProviders, SupportedProviderParams> = {
    virtual_lb: {
        id: CustomProviders.virtual_lb,
        name: 'Virtual - Load Balancer',
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    virtual_mediator: {
        id: CustomProviders.virtual_mediator,
        name: 'Virtual - Mediator',
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    test: {
        id: CustomProviders.test,
        name: 'Test LLM',
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
};

export const SupportedProvidersList: Record<SupportedProviders, SupportedProviderParams> = {
    ...ProviderList,
    ...CustomProvidersList,
} as const;

// The environment contract types, inferred from `./api-schemas/environment.js`. Their documentation
// moved with them: a doc comment above one of these is published on top of the schema's own
// `description`, so there would be two statements of it.
//
// `LoadBalancingEnvEntryConfig` no longer `extends VirtualEnvEntry` — a mapped or extended type over
// a canonical alias is opaque to the scanner and would publish as an empty object. It restates
// `model`, which is what the component has always listed anyway.
export type VirtualEnvEntry = z.infer<typeof VirtualEnvEntrySchema>;

export type ListEnvironmentsQuery = z.infer<typeof ListEnvironmentsQuerySchema>;

export type LoadBalancingEnvConfig = z.infer<typeof LoadBalancingEnvConfigSchema>;

export type LoadBalancingEnvEntryConfig = z.infer<typeof LoadBalancingEnvEntryConfigSchema>;

export type MediatorEnvConfig = z.infer<typeof MediatorEnvConfigSchema>;

// Re-exported, not restated. This file carried a byte-for-byte copy of llumiverse's interface, which
// published under the same component name — so which of the two the OpenAPI document described
// depended on which one the scanner reached first. They agreed, so nothing ever failed.
export type { TextFallbackOptions } from '@llumiverse/common';

export type ExecutionEnvironmentSettings = z.infer<typeof ExecutionEnvironmentSettingsSchema>;

/**
 * Returns the configured Vertex AI bucket access principal for an environment, or undefined.
 * Only Vertex AI environments expose this setting; the value is trimmed and empty strings
 * are treated as unset so callers get a single, normalized representation.
 */
export function getVertexBucketAccessPrincipal(
    env: { provider?: SupportedProviders; settings?: ExecutionEnvironmentSettings } | undefined,
): string | undefined {
    if (!env || env.provider !== SupportedProviders.vertexai) return undefined;
    const principal = env.settings?.bucket_access_principal;
    return typeof principal === 'string' && principal.trim().length > 0 ? principal.trim() : undefined;
}

export type ExecutionEnvironment = z.infer<typeof ExecutionEnvironmentSchema>;

export type ExecutionEnvironmentRef = z.infer<typeof ExecutionEnvironmentRefSchema>;

// Write payloads have their own named schemas because their fields differ from the read response.
export type ExecutionEnvironmentCreatePayload = z.infer<typeof ExecutionEnvironmentCreatePayloadSchema>;

export type ExecutionEnvironmentUpdatePayload = z.infer<typeof ExecutionEnvironmentUpdatePayloadSchema>;

export type ExecutionEnvironmentConfigUpdatePayload = z.infer<typeof ExecutionEnvironmentConfigUpdatePayloadSchema>;

export type EnableEnvironmentModelPayload = z.infer<typeof EnableEnvironmentModelPayloadSchema>;

export type MigrateInteractionsPayload = z.infer<typeof MigrateInteractionsPayloadSchema>;

export type MigrateInteractionsResult = z.infer<typeof MigrateInteractionsResultSchema>;
