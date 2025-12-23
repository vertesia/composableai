import { CompletionResult, ExecutionTokenUsage, StatelessExecutionOptions, ToolUse } from "@llumiverse/common";
import { ExecutionEnvironmentRef } from "../environment.js";
import { ConversationStripOptions } from "../interaction.js";
import { ExecutionRunDocRef } from "../runs.js";
import { Plan } from "./workflow.js";

/**
 * Lightweight tool reference for activity payloads.
 * References tools stored in GCP instead of embedding full tool definitions.
 */
export interface ToolReference {
    storage_key: string;
    tool_count: number;
    stored_at: string;
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
    environment: ExecutionEnvironmentRef;

    /**
     * The options to use on the next call.
     */
    options: StatelessExecutionOptions;

    /**
     * The tools to call next.
     */
    tool_use?: ToolUse[];

    /**
     * The output of the this conversation step
     */
    output: CompletionResult[];

    /**
     * The token usage of the this conversation step
     */
    token_usage?: ExecutionTokenUsage;

    /** If a sub workflow execution, contains the parent's info */
    parent?: {
        run_id: string;
        workflow_id: string;
        run_depth: number;
    };

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

    /** Skills that have been used in this conversation (for auto-syncing scripts and package installation) */
    used_skills?: UsedSkill[];

    /** All available skills from registered tool collections (for upfront hydration in sandbox) */
    available_skills?: AvailableSkill[];

    /** Whether to stream LLM responses to Redis (cached from project config) */
    streaming_enabled?: boolean;

    /**
     * Email thread tracking for email-based conversations.
     * Stores info needed to maintain proper email threading when replying via email.
     */
    email_thread?: EmailThreadInfo;
}

/**
 * Email thread information for maintaining proper threading in email replies.
 */
export interface EmailThreadInfo {
    /** The original email subject (without "Re:" prefix) */
    subject: string;
    /** The most recent message ID (for In-Reply-To header) */
    last_message_id: string;
    /** Chain of message IDs in the thread (for References header) */
    references: string[];
}

/** Skill metadata collected at workflow start for upfront sandbox hydration */
export interface AvailableSkill {
    /** Skill name (e.g., "analyze_data") - without the "learn_" prefix */
    name: string;
    /** Source URL of the skill collection (e.g., "https://tools.vertesia.io/api/skills/data-analysis") */
    src: string;
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
