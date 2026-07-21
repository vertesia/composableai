import type { CompletionResult, ExecutionTokenUsage, StatelessExecutionOptions, ToolUse } from '@llumiverse/common';
import type { ConversationStripOptions, ResolvedInteractionExecutionInfo, UserChannel } from '../interaction.js';
import type { ExecutionRunDocRef } from '../runs.js';
import type { AgentToolApprovalMode, PendingToolApprovalResults, ToolApprovalGrant } from './agent-approval.js';
import type { Plan, WorkflowAncestor } from './workflow.js';

/**
 * Lightweight tool reference for activity payloads.
 * References tools stored in GCP instead of embedding full tool definitions.
 */
export interface ToolReference {
    storage_key: string;
    tool_count: number;
    stored_at: string;
}

/** Reference to text content externalized to agent artifact storage. */
export interface TextArtifactReference {
    storage_id: string;
    artifact_path: string;
    display_ref: string;
    sha256: string;
    size_bytes: number;
    content_type: string;
}

/**
 * Sidecar metadata for generated tool input fields that were stored outside
 * model-visible tool_input. Keyed by tool_use.id on ConversationState.
 */
export interface ExternalizedToolInputRef {
    tool_name: string;
    input_path: ['content'];
    ref: TextArtifactReference;
}

export interface ExternalizedToolInputRefs {
    [toolUseId: string]: ExternalizedToolInputRef[];
}

export function toolInputRefsArtifactPath(storageId: string): string {
    return `agents/${storageId}/tool-input-refs.json`;
}

/**
 * Conversation state passed between workflow activities.
 * Contains all context needed to continue a multi-turn agent conversation.
 */
export interface ConversationState {
    /**
     * A reference to the run that started the conversation
     */
    run: ExecutionRunDocRef;

    /**
     * The execution environment with provider info for LLM calls.
     */
    environment: string;

    /**
     * The options to use on the next call.
     */
    options: StatelessExecutionOptions;

    /**
     * The tools to call next.
     */
    tool_use?: ToolUse[];

    /** Effective side-effecting tool approval mode for this interactive conversation. */
    tool_approval_mode?: AgentToolApprovalMode;

    /** Run-scoped, exact-target grants created by "allow this action for this run". */
    tool_approval_grants?: Record<string, ToolApprovalGrant>;

    /** Buffered tool results held while approval denial pauses until the next user message. */
    pending_tool_approval_results?: PendingToolApprovalResults;

    /** Compact, redacted latest user intent for reviewer-style system interactions. */
    latest_user_message?: string;

    /**
     * Transport sidecar for large generated tool input fields.
     *
     * These refs are intentionally kept out of tool_use.tool_input so they are
     * not shown to the model. Tool execution hydrates them from artifact storage
     * immediately before activity validation.
     */
    tool_input_refs?: ExternalizedToolInputRefs;

    /**
     * The output of the this conversation step
     */
    output: CompletionResult[];

    /**
     * The token usage of the this conversation step
     */
    token_usage?: ExecutionTokenUsage;

    /** If a sub workflow execution, contains the parent's info */
    parent?: WorkflowAncestor;

    /** Full ancestry chain from root to immediate parent (for hierarchical aggregation) */
    ancestors: WorkflowAncestor[];

    /** If part of a larger agentic workflow, task id of this task */
    task_id?: string;

    /** Stores the most recent plan for reference by plan-related tools */
    plan?: Plan;

    /** Debug mode (more logs and persisted artifacts) */
    debug?: boolean;

    /**
     * Configuration for stripping large data from conversation history.
     * Passed to llumiverse ExecutionOptions.stripImagesAfterTurns.
     */
    strip_options?: ConversationStripOptions;

    /** Conversation artifacts base url */
    conversation_artifacts_base_url?: string;

    /** Reference to tools stored in GCP instead of embedding full tool definitions */
    tool_reference?: ToolReference;

    /** Names of currently active tools (base + unlocked). Tool definitions loaded from tool_reference. */
    active_tool_names?: string[];

    /** Active tools that should not be evicted by bounded active-tool pruning. */
    pinned_tool_names?: string[];

    /**
     * Activation and usage metadata for tools seen during the conversation.
     * Used to keep the active tool set bounded without losing recovery context.
     */
    tool_activation_metadata?: Record<string, ToolActivationMetadata>;

    /** Skills that have been used in this conversation (for auto-syncing scripts and package installation) */
    used_skills?: UsedSkill[];

    /** All available skills from registered tool collections (for upfront hydration in sandbox) */
    available_skills?: AvailableSkill[];

    /** Whether to stream LLM responses to Redis (cached from project config) */
    streaming_enabled?: boolean;

    /**
     * Active communication channels with their current state.
     * Channels can be updated as conversation progresses (e.g., email threading info).
     */
    user_channels?: UserChannel[];

    /**
     * The resolved interaction execution info.
     * Contains interaction ID, name, version, and environment details.
     */
    resolvedInteraction?: ResolvedInteractionExecutionInfo;

    /**
     * End conversation metadata set when end_conversation tool is called.
     * Signals the workflow to terminate gracefully.
     */
    end_conversation?: {
        final_result?: string;
        status?: 'success' | 'failure';
        reason?: string;
    };

    /**
     * Tools that have been unlocked by skills during the conversation.
     * These tools were initially hidden (default: false) but became available
     * when a skill with tools was called.
     */
    unlocked_tools?: string[];

    /**
     * Activity ID from the latest LLM call (for deduplication with streamed content).
     * Set by streamToRedis when completing async activities.
     */
    latest_activity_id?: string;

    /**
     * Stable streaming ID from the latest LLM call.
     * Unlike Temporal activity IDs, this is scoped to the concrete workflow run
     * that produced the stream, so it remains safe across continue-as-new.
     */
    latest_streaming_id?: string;

    /**
     * Mapping of skill names to their related tools.
     * When a skill is called, its related tools are added to unlocked_tools.
     */
    skill_tool_map?: Record<string, string[]>;

    /**
     * Names of skills whose full instructions are already present in the live conversation
     * history (i.e. were delivered by a prior `learn_<skill>` call). Used to make skill
     * re-activation idempotent: a repeat call returns a short "already active" acknowledgement
     * instead of re-dumping the instructions.
     *
     * Unlike `unlocked_tools`/`skill_tool_map` (which must survive a checkpoint so tools stay
     * unlocked), this list is reset when a checkpoint compacts the conversation, because the
     * summary no longer carries the skill instructions and the next call must re-deliver them.
     */
    skill_instructions_delivered?: string[];

    /**
     * Denylist of MCP tool-collection ids deactivated for this conversation.
     * `undefined`/empty means all installed/connected MCP collections are active.
     * Updated mid-conversation via the MCP config signal; consumed when tools are re-discovered.
     */
    disabled_mcp_collections?: string[];

    /**
     * MCP servers that are active (not disabled) and accessible to the user but not yet
     * OAuth-connected. Surfaced to the agent (via discover_tools) so it can offer to connect.
     */
    pending_mcp_connections?: PendingMcpConnection[];

    /**
     * Current activity group ID for internal tool-execution progress messages.
     * All updates emitted during one tool-execution cycle should share this ID.
     */
    active_activity_group_id?: string;

    /** LLM stop reason from the latest call (e.g., "stop", "length", "tool_use") */
    finish_reason?: string;

    /**
     * The AgentRun ID (MongoDB _id) that owns this conversation.
     * Used for artifact storage paths: agents/{agent_run_id}/
     * Undefined for legacy workflows started before the AgentRun system.
     */
    agent_run_id?: string;

    /**
     * For workstreams: the launch ID assigned by the parent workflow.
     * When set, artifacts are stored under agents/{agent_run_id}/workstreams/{launch_id}/
     * to consolidate all artifacts under the parent agent run.
     */
    launch_id?: string;

    /**
     * The exact app version this run is pinned to, derived from the `@version` on the
     * started interaction ref / the `x-vertesia-app-version` header at start. Persisted on the state
     * so it survives resume, and applied to the activity client (`withAppVersion`) so every app-owned
     * ref the run resolves — interactions, types, processes, tools — targets this version instead of
     * the current/promoted one. Undefined → current/promoted. Resolution-time only; never a stored
     * capability-ref version.
     */
    app_version?: string;
}

/**
 * An MCP server the user can connect to but hasn't yet (active + accessible, no OAuth token).
 * Built at tool-discovery time and stored on the conversation state so the agent can
 * discover it (by description) and ask the user to connect.
 */
export interface PendingMcpConnection {
    /** The app installation id owning the collection (used for OAuth operations). */
    app_install_id: string;
    /** The MCP tool-collection id. */
    collection_id: string;
    /** Human-readable label for the server/collection. */
    name: string;
    /** Manifest description of what the server provides (used for discovery). */
    description?: string;
    /** Tool-name prefix for this collection. */
    namespace?: string;
}

/** Skill metadata collected at workflow start for upfront sandbox hydration */
export interface AvailableSkill {
    /** Skill name (e.g., "analyze_data") - without the "learn_" prefix */
    name: string;
    /** Source URL of the skill collection (e.g., "https://tools.vertesia.io/api/skills/data-analysis"). Undefined for interaction-based skills. */
    src?: string;
}

/**
 * Compute the storage ID for a conversation's artifacts.
 * - Root workflows:   `{agent_run_id}`  (or fallbackRunId if no agent_run_id)
 * - Workstreams:      `{agent_run_id}/workstreams/{launch_id}`
 *
 * Both studio-server and workflow activities must use the same logic so
 * parent and child conversations don't overwrite each other.
 */
export function getConversationStorageId(
    state: Pick<ConversationState, 'agent_run_id' | 'launch_id'> | undefined,
    fallbackRunId: string,
): string {
    const baseId = state?.agent_run_id || fallbackRunId;
    if (state?.launch_id && state?.agent_run_id) {
        return `${baseId}/workstreams/${state.launch_id}`;
    }
    return baseId;
}

/** Skill metadata tracked when a skill is used */
export interface UsedSkill {
    /** Skill name (e.g., "analyze_data") */
    name: string;
    /** Source URL of the skill collection (e.g., "https://tools.vertesia.io/api/skills/data-analysis") */
    src: string;
    /** Programming language (e.g., "python") */
    language?: string;
    /** Required packages (e.g., ["pandas", "numpy"]) */
    packages?: string[];
    /** System-level packages to install via sudo apt-get (e.g., ["poppler-utils"]) */
    system_packages?: string[];
}

export interface ToolActivationMetadata {
    /** Turn when the tool became active in this conversation. */
    activated_at_iteration: number;
    /** Most recent turn where the tool was actually executed. */
    last_used_iteration?: number;
    /** Number of successful executions in this conversation. */
    use_count: number;
    /** Activation source, e.g. "base", "discover_tools", "skill:presentation_authoring". */
    source: string;
    /** Whether this tool is pinned and should be preserved during eviction. */
    pinned?: boolean;
}
