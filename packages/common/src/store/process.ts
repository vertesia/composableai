import type { JSONSchema } from '../json-schema.js';
import type * as Wire from '../wire-types.generated.js';

export type JsonLogicRule = Wire.JsonLogicRule;

export type ProcessDefinitionStatus = Wire.ProcessDefinitionStatus;
export type ListProcessDefinitionsQuery = Wire.ListProcessDefinitionsQuery;
export type ListProcessTestRunsQuery = Wire.ListProcessTestRunsQuery;
export const PROCESS_DEFINITION_FORMAT_VERSION = 1 as const;
export type ProcessDefinitionFormatVersion = Wire.ProcessDefinitionFormatVersion;

export type ProcessNodeType = Wire.ProcessNodeType;

export type TransitionTrigger = Wire.TransitionTrigger;
export type ParallelFailurePolicy = Wire.ParallelFailurePolicy;
export type ProcessNodeRunType = Wire.ProcessNodeRunType;
export type ParallelCollectMode = Wire.ParallelCollectMode;
export type BranchJoinPolicy = Wire.BranchJoinPolicy;
export type ProcessDefinitionMetadata = Wire.ProcessDefinitionMetadata;
export type ProcessAgentToolPhase = Wire.ProcessAgentToolPhase;
export type ProcessAgentToolInputContains = Wire.ProcessAgentToolInputContains;
export type ProcessAgentPhaseReset = Wire.ProcessAgentPhaseReset;
export type ProcessAgentExecutionPolicy = Wire.ProcessAgentExecutionPolicy;
export type ProcessScriptLanguage = Wire.ProcessScriptLanguage;

export type ProcessScriptInlineSource = Wire.ProcessScriptInlineSource;

export type ProcessScriptSource = Wire.ProcessScriptSource;

export type ProcessScriptResource = Wire.ProcessScriptResource;

export type ProcessResourcesDefinition = Wire.ProcessResourcesDefinition;
export type ParallelCollectField = Wire.ParallelCollectField;

export type TransitionDefinition = Wire.TransitionDefinition;

export type BranchDefinition = Wire.BranchDefinition;

export interface BranchNodeBranchDefinition {
    id: string;
    title?: string;
    description?: string;
    node: NodeDefinition;
    metadata?: ProcessDefinitionMetadata;
}

export type HumanTaskDefinition = Wire.HumanTaskDefinition;

export type ProcessNodeReturnsDefinition = Wire.ProcessNodeReturnsDefinition;

export type ParallelCollectDefinition = Wire.ParallelCollectDefinition;

export interface NodeDefinition {
    type: ProcessNodeType;
    tool?: string;
    /** Named entry in process resources.scripts for script nodes. */
    script?: string;
    /** Script execution timeout in seconds. Defaults to 300 and is capped at 600. */
    timeout?: number;
    interaction?: string;
    process?: string;
    process_definition?: ProcessDefinitionBody;
    process_version?: number;
    run_type?: ProcessNodeRunType;
    returns?: ProcessNodeReturnsDefinition;
    /**
     * Optional JSON Schema for structured output produced by interaction and
     * agent nodes. When omitted, the process engine derives a schema from
     * `writes` and the process context schema.
     */
    result_schema?: JSONSchema;
    prompt?: string;
    input?: Record<string, unknown>;
    /**
     * Whether interaction and custom-agent nodes receive the complete process
     * context in addition to resolved `input`. Defaults to true for backward
     * compatibility. Set false to keep specialist prompts input-only.
     */
    inherit_context?: boolean;
    config?: Record<string, unknown>;
    title?: string;
    description?: string;
    /**
     * End-user-facing explanation of what this node does. Authored by the
     * process designer (often an LLM) in plain language — one or two
     * sentences — and rendered in run observability so a human reading the
     * run can understand why this node exists without reading the config.
     * Distinct from `description`, which is developer-facing.
     */
    human_description?: string;
    writes?: string[];
    skippable?: boolean;
    max_retries?: number;
    transitions?: TransitionDefinition[];
    tools?: string[];
    /** Builtin system skills activated before the agent node's first model turn. */
    initial_skills?: string[];
    /** Execution-time tool denylist for the agent node's child conversation. */
    excluded_tools?: string[];
    /** Process-owned successful-tool phases and completion behavior for this agent node. */
    agent_policy?: ProcessAgentExecutionPolicy;
    /**
     * Model id override for this node. If unset, falls back to the process
     * run's `config.model`, then to the project's default. Useful when a
     * specific node needs heavier reasoning (e.g. Opus for legal flagging)
     * while the rest of the process uses a cheaper default.
     */
    model?: string;
    task?: HumanTaskDefinition;
    foreach?: string;
    as?: string;
    item_id?: string;
    node?: NodeDefinition;
    max_concurrency?: number;
    collect?: string | ParallelCollectDefinition;
    failure_policy?: ParallelFailurePolicy;
    join?: BranchJoinPolicy;
    branches?: BranchDefinition[] | BranchNodeBranchDefinition[];
    metadata?: ProcessDefinitionMetadata;
}

export type ProcessContextDefinition = Wire.ProcessContextDefinition;

export interface ProcessDefinitionBody {
    format_version: ProcessDefinitionFormatVersion;
    process: string;
    description?: string;
    initial: string;
    model?: string;
    resources?: ProcessResourcesDefinition;
    context: ProcessContextDefinition;
    nodes: Record<string, NodeDefinition>;
    metadata?: ProcessDefinitionMetadata;
}

export interface InCodeProcessDefinition {
    /**
     * Process identifier exposed by an app package. App-local ids are normalized
     * by Studio to `app:<app-name>:<id>` when returned to callers.
     */
    id: string;
    /** Human-readable or app-local process name. */
    name: string;
    title?: string;
    description?: string;
    tags?: string[];
    definition: ProcessDefinitionBody;
}

export type ProcessDefinitionRevisionInfo = Wire.ProcessDefinitionRevisionInfo;

export interface ProcessDefinition {
    id: string;
    edit_revision: number;
    account: string;
    project: string;
    name: string;
    description?: string;
    status: ProcessDefinitionStatus;
    version: number;
    revision?: ProcessDefinitionRevisionInfo;
    tags?: string[];
    definition: ProcessDefinitionBody;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
}

export type NodeHistoryEntry = Wire.NodeHistoryEntry;

export type ProcessHistoryRef = Wire.ProcessHistoryRef;

export interface ProcessHistoryCheckpoint {
    sequence: number;
    current_node: string;
    written_at: Date | string;
    entries: NodeHistoryEntry[];
}

export type ProcessState = Wire.ProcessState;

export interface CreateProcessDefinitionPayload {
    name: string;
    description?: string;
    /**
     * @deprecated Process definitions are created as drafts. Use the publish endpoint
     * to create immutable published versions.
     */
    status?: ProcessDefinitionStatus;
    /**
     * @deprecated Version is server-owned. Use the publish endpoint to create the next version.
     */
    version?: number;
    tags?: string[];
    definition: ProcessDefinitionBody;
}

export interface UpdateProcessDefinitionPayload {
    expected_edit_revision?: number;
    name?: string;
    description?: string;
    /**
     * @deprecated Status is server-owned. Use publish/archive endpoints instead of updating it directly.
     */
    status?: ProcessDefinitionStatus;
    /**
     * @deprecated Version is server-owned. Use the publish endpoint to create the next version.
     */
    version?: number;
    tags?: string[];
    definition?: ProcessDefinitionBody;
}

export type PublishProcessDefinitionPayload = Wire.PublishProcessDefinitionPayload;

export type RevertProcessDefinitionPayload = Wire.RevertProcessDefinitionPayload;

export type AdvanceProcessPayload = Wire.AdvanceProcessPayload;

export type AnswerProcessTaskPayload = Wire.AnswerProcessTaskPayload;

export type RetryProcessNodePayload = Wire.RetryProcessNodePayload;

export type ProcessContextResponse = Wire.ProcessContextResponse;

export type ProcessHistoryResponse = Wire.ProcessHistoryResponse;

export type ProcessTestRunStatus = Wire.ProcessTestRunStatus;
export type ProcessTestVirtualActor = Wire.ProcessTestVirtualActor;
export type ProcessTestFixtureResult = Wire.ProcessTestFixtureResult;
export type ProcessTestFixtureError = Wire.ProcessTestFixtureError;
export type ProcessTestFixtureResponse = Wire.ProcessTestFixtureResponse;
export type ProcessTestNodeFixture = Wire.ProcessTestNodeFixture;
export type ProcessTestHumanAction = Wire.ProcessTestHumanAction;
export type ProcessTestAssertions = Wire.ProcessTestAssertions;
export type ProcessTestScenario = Wire.ProcessTestScenario;
export type ProcessTestSuite = Wire.ProcessTestSuite;
export type CreateProcessTestSuitePayload = Wire.CreateProcessTestSuitePayload;
export type UpdateProcessTestSuitePayload = Wire.UpdateProcessTestSuitePayload;
export type StartProcessTestRunPayload = Wire.StartProcessTestRunPayload;
export type ProcessTestAssertionResult = Wire.ProcessTestAssertionResult;
export type ProcessTestActorDecision = Wire.ProcessTestActorDecision;
export type ProcessTestCoverage = Wire.ProcessTestCoverage;
export type ProcessTestChildTrace = Wire.ProcessTestChildTrace;
export type ProcessTestScenarioResult = Wire.ProcessTestScenarioResult;
export type ProcessTestRun = Omit<Wire.ProcessTestRunWire, 'process_definition_snapshot'> & {
    process_definition_snapshot: ProcessDefinitionBody;
};
export type ProcessTestStoredSubject = Wire.ProcessTestStoredSubject;
export type ProcessTestResolvedSubject = Wire.ProcessTestResolvedSubject;
export type ProcessTestInlineSubject = Wire.ProcessTestInlineSubject;
export type ProcessTestSubject = Wire.ProcessTestSubject;
export type ProcessTestTargetById = Wire.ProcessTestTargetById;
export type ProcessTestTargetWithDefinition = Omit<Wire.ProcessTestTargetWithDefinitionWire, 'definition'> & {
    definition: ProcessDefinitionBody;
};
export type ProcessTestTarget = ProcessTestTargetById | ProcessTestTargetWithDefinition;
export type SubmitProcessTestRunPayload = Omit<Wire.SubmitProcessTestRunPayloadWire, 'process'> & {
    process: ProcessTestTarget;
};
export type UpdateProcessTestScenarioPayload = Wire.UpdateProcessTestScenarioPayload;
