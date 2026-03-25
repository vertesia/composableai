import { AgentRunStatus } from './agent-run.js';

/**
 * Archive manifest stored at:
 *   agents/{agentRunId}/archive/v1/manifest.json
 *
 * Describes the contents and metadata of an archived agent run.
 */
export interface ArchiveManifest {
    /** Archive format version */
    version: 1;

    /** Agent run ID */
    agent_run_id: string;

    /** Temporal workflow ID (stable across continueAsNew and restarts) */
    workflow_id: string;

    /** ISO timestamp of when this archive was created */
    archived_at: string;

    /** Status of the agent run at archive time */
    status: AgentRunStatus;

    /** Number of messages in messages.jsonl.gz */
    message_count: number;

    /** Number of child workflows archived */
    children_count: number;
}

/**
 * Redacted child workflow metadata stored in children.json.
 * Raw memo and searchAttributes are intentionally excluded.
 */
export interface ArchivedChildWorkflow {
    /** Temporal workflow ID */
    workflow_id: string;

    /** Temporal run ID */
    run_id: string;

    /** Workflow execution status */
    status: string;

    /** Workflow type name */
    type?: string;

    /** ISO timestamp */
    started_at?: string;

    /** ISO timestamp */
    closed_at?: string;
}
