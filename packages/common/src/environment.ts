import type { AIModel, TextFallbackOptions } from "@llumiverse/core";


export enum SupportedProviders {
    // from llumiverse
    openai = 'openai',
    azure_openai = 'azure_openai',
    huggingface_ie = 'huggingface_ie',
    replicate = 'replicate',
    bedrock = 'bedrock',
    vertexai = 'vertexai',
    togetherai = 'togetherai',
    mistralai = 'mistralai',
    groq = 'groq',
    watsonx = 'watsonx',
    // from studio
    virtual_lb = 'virtual_lb',
    virtual_mediator = 'virtual_mediator',
    test = 'test'
}

export interface SupportedProviderParams {
    id: SupportedProviders;
    name: string;
    requiresApiKey: boolean;
    requiresEndpointUrl: boolean;
    endpointPlaceholder?: string;
    supportSearch?: boolean;
}

export const SupportedProvidersList: Record<SupportedProviders, SupportedProviderParams> = {
    'openai':
    {
        id: SupportedProviders.openai,
        name: "OpenAI",
        requiresApiKey: true,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    'azure_openai':
    {
        id: SupportedProviders.azure_openai,
        name: "Azure OpenAI",
        requiresApiKey: false,
        requiresEndpointUrl: true,
        supportSearch: false,
    },
    'huggingface_ie':
    {
        id: SupportedProviders.huggingface_ie,
        name: "HuggingFace Inference Endpoint",
        requiresApiKey: true,
        requiresEndpointUrl: true,
    },
    'replicate':
    {
        id: SupportedProviders.replicate,
        name: "Repicate",
        requiresApiKey: true,
        requiresEndpointUrl: false,
        supportSearch: true,
    },
    'bedrock':
    {
        id: SupportedProviders.bedrock,
        name: "AWS Bedrock",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        endpointPlaceholder: "region name (eg. us-east-1)",
        supportSearch: false,
    },
    vertexai: {
        id: SupportedProviders.vertexai,
        name: "Google Vertex AI",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    togetherai: {
        id: SupportedProviders.togetherai,
        name: "Together AI",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    mistralai: {
        id: SupportedProviders.mistralai,
        name: "Mistral AI",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    groq: {
        id: SupportedProviders.groq,
        name: "Groq Cloud",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    watsonx: {
        id: SupportedProviders.watsonx,
        name: "IBM WatsonX",
        requiresApiKey: true,
        requiresEndpointUrl: true,
        supportSearch: false
    },
    'virtual_lb':
    {
        id: SupportedProviders.virtual_lb,
        name: "Virtual - Load Balancer",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    'virtual_mediator':
    {
        id: SupportedProviders.virtual_mediator,
        name: "Virtual - Mediator",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
    'test': {
        id: SupportedProviders.test,
        name: "Test LLM",
        requiresApiKey: false,
        requiresEndpointUrl: false,
        supportSearch: false,
    },
};


export interface VirtualEnvEntry {
    model: string;
}

/**
 * Custom configuration for virtual environments
 **/
export interface LoadBalancingEnvConfig {
    entries?: LoadBalancingEnvEntryConfig[];
    balance_if_failed?: boolean;
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
