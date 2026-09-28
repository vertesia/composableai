import type { ProviderParams } from '@llumiverse/common';
import { ProviderList, Providers } from '@llumiverse/common';
import type * as Wire from './wire-types.generated.js';

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

export type SupportedProviders = Wire.SupportedProviders;

export interface SupportedProviderParams extends Omit<ProviderParams, 'id'> {
    id: SupportedProviders;
}

const CustomProvidersList: Record<CustomProviders, SupportedProviderParams> = {
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
export type VirtualEnvEntry = Wire.VirtualEnvEntry;

export type ListEnvironmentsQuery = Wire.ListEnvironmentsQuery;

export type LoadBalancingEnvConfig = Wire.LoadBalancingEnvConfig;

export type LoadBalancingEnvEntryConfig = Wire.LoadBalancingEnvEntryConfig;

export type MediatorEnvConfig = Wire.MediatorEnvConfig;

// Re-exported, not restated. This file carried a byte-for-byte copy of llumiverse's interface, which
// published under the same component name — so which of the two the OpenAPI document described
// depended on which one the scanner reached first. They agreed, so nothing ever failed.
export type { TextFallbackOptions } from '@llumiverse/common';

export type ExecutionEnvironmentSettings = Wire.ExecutionEnvironmentSettings;

export type ExecutionEnvironment = Wire.ExecutionEnvironment;

export type ExecutionEnvironmentRef = Wire.ExecutionEnvironmentRef;

// Write payloads have their own named schemas because their fields differ from the read response.
export type ExecutionEnvironmentCreatePayload = Wire.ExecutionEnvironmentCreatePayload;

export type ExecutionEnvironmentUpdatePayload = Wire.ExecutionEnvironmentUpdatePayload;

export type ExecutionEnvironmentConfigUpdatePayload = Wire.ExecutionEnvironmentConfigUpdatePayload;

export type EnableEnvironmentModelPayload = Wire.EnableEnvironmentModelPayload;

export type MigrateInteractionsPayload = Wire.MigrateInteractionsPayload;

export type MigrateInteractionsResult = Wire.MigrateInteractionsResult;
