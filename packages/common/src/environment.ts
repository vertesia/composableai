import type { AIModel, ProviderParams, TextFallbackOptions } from "@llumiverse/common";
import { ProviderList, Providers } from "@llumiverse/common";

// Virtual providers from studio
export enum CustomProviders {
    virtual_lb = 'virtual_lb',
    virtual_mediator = 'virtual_mediator',
    test = 'test'
}

export type SupportedProviders = Providers | CustomProviders;

export const SupportedProviders = {
    ...Providers,
    ...CustomProviders
} as const;

export interface SupportedProviderParams extends Omit<ProviderParams, 'id'> {
    id: SupportedProviders;
}

export const CustomProvidersList: Record<CustomProviders, SupportedProviderParams> = {
    virtual_lb:
    {
        id: CustomProviders.virtual_lb,
        name: "Virtual - Load Balancer",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    virtual_mediator:
    {
        id: CustomProviders.virtual_mediator,
        name: "Virtual - Mediator",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    test: {
        id: CustomProviders.test,
        name: "Test LLM",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
};

export const SupportedProvidersList: Record<SupportedProviders, SupportedProviderParams> = {
    ...ProviderList,
    ...CustomProvidersList
} as const;


export interface VirtualEnvEntry {
    model: string;
}

/**
 * Custom configuration for virtual environments
 **/
export interface LoadBalancingEnvConfig {
    entries?: LoadBalancingEnvEntryConfig[];
    failover?: boolean;
}

export interface LoadBalancingEnvEntryConfig extends VirtualEnvEntry {
    weight: number;
}

export interface MediatorEnvConfig {
    entries?: VirtualEnvEntry[];
    max_concurrent_requests?: number;
    // the model used to evaluate the responses. If not specified all entries will mediates the response
    // and the best response will be picked
    mediators?: VirtualEnvEntry[];
    model_options?: TextFallbackOptions;
}

export interface ExecutionEnvironment {
    id: string;
    name: string;
    provider: SupportedProviders;
    description?: string;
    endpoint_url?: string;
    default_model?: string;
    enabled_models?: AIModel[];
    apiKey?: string;
    config?: any;
    account: string;
    allowed_projects?: string[];
    created_by: string,
    updated_by: string,
    created_at: string;
    updated_at: string;
}

export interface ExecutionEnvironmentRef {
    id: string;
    name: string;
    provider: SupportedProviders;
    enabled_models?: AIModel[];
    default_model?: string;
    endpoint_url?: string;
    allowed_projects?: string[];
    account: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export const ExecutionEnvironmentRefPopulate = "id name provider enabled_models default_model endpoint_url allowed_projects account created_at updated_at";

export interface ExecutionEnvironmentCreatePayload extends Omit<ExecutionEnvironment, 'id' | 'account' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'project'> { }
export interface ExecutionEnvironmentUpdatePayload extends Partial<Omit<ExecutionEnvironment, 'id' | 'account' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>> { }

export interface MigrateInteractionsPayload {
    /**
     * The new environment ID to set in the Interactions
     */
    new_env_id: string;
    /**
     * The new model ID to set in the Interactions
     */
    new_model_id: string;
    /**
     * The list of Interaction IDs to update.
     *
     * The Interactions must be in draft status.
     */
    interaction_ids: string[];
}

export interface MigrateInteractionsResult {
    matched_count: number;
    modified_count: number;
}