import type {
    CompletionResult,
    ExecutionTokenUsage,
    JSONSchema,
    ModelOptions,
    ToolDefinition,
    ToolUse,
} from '@llumiverse/common';
import type { SupportedProviders } from './environment.js';
import type { AsyncCompletionOptions, NamedInteractionExecutionPayload, PromptModalities } from './interaction.js';
import type { ExecutionRunDocRef } from './runs.js';

export interface InferenceDataSource {
    name?: string;
    mime_type?: string;
    url?: string;
    data?: string;
}

export interface InferencePromptSegment {
    role: string;
    content?: string;
    tool_use_id?: string;
    thought_signature?: string;
    files?: InferenceDataSource[];
}

export interface InferenceProviderConfig {
    provider: SupportedProviders;
    environment_id: string;
    environment_name: string;
    environment_updated_at?: string;
    api_key?: string;
    endpoint_url?: string;
    region?: string;
    project?: string;
    aws_role_arn?: string;
    aws_web_identity_token?: string;
    google_workload_identity_audience?: string;
    google_subject_token?: string;
    settings?: Record<string, unknown>;
}

export interface InferenceExecutionOptions {
    model: string;
    model_options?: ModelOptions;
    http_timeout?: unknown;
    result_schema?: JSONSchema;
    output_modality?: string;
    conversation?: unknown;
    tools?: ToolDefinition[];
    labels?: Record<string, string>;
}

export interface InferenceLedgerPrepareRequest {
    interaction?: string;
    payload?: NamedInteractionExecutionPayload;
    run?: ExecutionRunDocRef;
    run_id?: string;
    conversation?: unknown;
    tools?: ToolDefinition[];
}

export interface InferenceLedgerCreateRunRequest {
    payload: NamedInteractionExecutionPayload;
}

export interface InferenceLedgerCreateRunResponse {
    run: ExecutionRunDocRef;
    run_doc: unknown;
    run_lease: string;
}

export interface InferenceLedgerProviderContextRequest {
    run: ExecutionRunDocRef;
    environment_id?: string;
}

export interface InferenceLedgerProviderContextResponse {
    run: ExecutionRunDocRef;
    run_lease: string;
    provider: InferenceProviderConfig;
    labels?: Record<string, string>;
}

export interface InferenceLedgerPrepareResponse {
    run: ExecutionRunDocRef;
    run_doc: unknown;
    run_lease: string;
    segments: InferencePromptSegment[];
    options: InferenceExecutionOptions;
    provider: InferenceProviderConfig;
    asyncCompletion?: AsyncCompletionOptions;
    conversation_mode?: boolean;
}

export interface InferenceExecutionError {
    code?: string;
    message: string;
    retryable?: boolean;
    data?: unknown;
}

export interface InferenceExecutionCompletion {
    result?: CompletionResult[];
    token_usage?: ExecutionTokenUsage;
    tool_use?: ToolUse[];
    finish_reason?: string;
    error?: string | InferenceExecutionError;
    original_response?: unknown;
    conversation?: unknown;
    prompt?: unknown;
    execution_time_ms?: number;
    chunks?: number;
    options?: InferenceExecutionOptions;
}

export interface InferenceLedgerCompleteRequest {
    run_lease: string;
    completion: InferenceExecutionCompletion;
    conversation_done?: boolean;
}

export interface InferenceLedgerUsageRequest {
    run_lease: string;
    token_usage?: ExecutionTokenUsage;
    execution_time_ms?: number;
}

export interface InferenceLedgerFailRequest {
    run_lease: string;
    error: InferenceExecutionError;
    prompt?: unknown;
}

export interface InferenceLedgerAsyncCompleteRequest {
    run_lease: string;
    asyncCompletion: AsyncCompletionOptions;
    completion: InferenceExecutionCompletion;
}

export interface InferenceLedgerAsyncFailRequest {
    run_lease: string;
    asyncCompletion: AsyncCompletionOptions;
    error: InferenceExecutionError;
}

export interface InferenceLedgerAsyncHeartbeatRequest {
    run_lease: string;
    asyncCompletion: AsyncCompletionOptions;
}

export interface InferenceRateLimitResolveRequest {
    interaction: string;
    environment_id?: string;
    model_id?: string;
    modalities?: PromptModalities;
}

export interface InferenceRateLimitResolveResponse {
    interaction_id: string;
    environment_id: string;
    model_id: string;
}
