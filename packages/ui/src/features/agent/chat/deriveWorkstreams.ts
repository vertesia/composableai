/**
 * Reconstructs the workstream list from the message stream, and merges it with the
 * live `getActiveWorkstreams` query result.
 *
 * Persisted messages are the source of truth once a workflow can no longer be queried,
 * so a consumer that renders its own workstream UI needs both halves: derive from
 * messages, then fold the query entries in with `mergeWorkstreamInfo`.
 */

import {
    type ActiveWorkstreamEntry,
    type AgentMessage,
    AgentMessageType,
    type CompletedWorkstreamEntry,
} from '@vertesia/common';
import { getWorkstreamId } from './ModernAgentOutput/utils.js';
import {
    getWorkstreamLaunchDetails,
    getWorkstreamLifecycleStatus,
    isWorkstreamInternalResultMessage,
    type WorkstreamInfo,
} from './workstreams.js';

function getTimestampMs(timestamp: number | string | undefined): number {
    if (typeof timestamp === 'number') return timestamp;
    if (!timestamp) return Date.now();
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
}

type DerivedWorkstreamInfo = WorkstreamInfo & {
    started_at: number;
    updated_at: number;
    order: number;
};

export function isActiveWorkstreamStatus(status: WorkstreamInfo['status']) {
    return status === 'running' || status === 'canceling';
}

export function isTerminalWorkstreamStatus(status: WorkstreamInfo['status']) {
    return !isActiveWorkstreamStatus(status);
}

/**
 * Folds `next` into `existing` without letting a stale "still running" query entry
 * resurrect a workstream that the message stream already settled.
 */
export function mergePreservingTerminalStatus(existing: WorkstreamInfo, next: WorkstreamInfo): WorkstreamInfo {
    if (!isTerminalWorkstreamStatus(existing.status) || !isActiveWorkstreamStatus(next.status)) {
        return { ...existing, ...next };
    }

    return {
        ...existing,
        interaction: existing.interaction ?? next.interaction,
        elapsed_ms: Math.max(existing.elapsed_ms, next.elapsed_ms),
        deadline_ms: Math.max(existing.deadline_ms, next.deadline_ms),
        remaining_ms: 0,
        phase: existing.phase ?? next.phase,
        child_workflow_id: existing.child_workflow_id ?? next.child_workflow_id,
        child_workflow_run_id: existing.child_workflow_run_id ?? next.child_workflow_run_id,
    };
}

function getWorkstreamMessageDetails(message: AgentMessage): {
    workstreamId: string;
    launchId?: string;
    interaction?: string;
    childWorkflowId?: string;
    childWorkflowRunId?: string;
} | null {
    const details = message.details as
        | {
              workstream_id?: unknown;
              launch_id?: unknown;
              interaction?: unknown;
              child_workflow_id?: unknown;
              child_workflow_run_id?: unknown;
          }
        | undefined;

    const workstreamId =
        typeof details?.workstream_id === 'string' && details.workstream_id.trim()
            ? details.workstream_id
            : getWorkstreamId(message);

    if (workstreamId === 'main' || workstreamId === 'all') return null;

    return {
        workstreamId,
        launchId: typeof details?.launch_id === 'string' ? details.launch_id : undefined,
        interaction: typeof details?.interaction === 'string' ? details.interaction : undefined,
        childWorkflowId: typeof details?.child_workflow_id === 'string' ? details.child_workflow_id : undefined,
        childWorkflowRunId:
            typeof details?.child_workflow_run_id === 'string' ? details.child_workflow_run_id : undefined,
    };
}

function isWorkstreamActivityFailureMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.ERROR) return false;

    const details = message.details as
        | {
              activity_group_id?: unknown;
              event_class?: unknown;
              tool?: unknown;
              tool_event?: unknown;
              tool_run_id?: unknown;
              tool_status?: unknown;
              workstream_event?: unknown;
          }
        | undefined;

    if (details?.event_class !== 'activity') return false;
    if (details.workstream_event) return false;

    return !(
        details.tool ||
        details.tool_status ||
        details.tool_run_id ||
        details.activity_group_id ||
        details.tool_event
    );
}

function ensureWorkstreamRecord(
    records: Map<string, DerivedWorkstreamInfo>,
    latestKeyByWorkstream: Map<string, string>,
    workstreamId: string,
    launchId: string | undefined,
    timestamp: number,
    order: number,
): DerivedWorkstreamInfo {
    if (launchId) {
        const previousKey = latestKeyByWorkstream.get(workstreamId);
        if (previousKey?.startsWith('message-derived:')) {
            const previous = records.get(previousKey);
            if (previous) {
                records.delete(previousKey);
                records.set(launchId, {
                    ...previous,
                    launch_id: launchId,
                    updated_at: Math.max(previous.updated_at, timestamp),
                });
            }
        }
        latestKeyByWorkstream.set(workstreamId, launchId);
    }

    const key = launchId ?? latestKeyByWorkstream.get(workstreamId) ?? `message-derived:${workstreamId}`;
    const existing = records.get(key);
    if (existing) return existing;

    const record: DerivedWorkstreamInfo = {
        workstream_id: workstreamId,
        launch_id: key,
        elapsed_ms: 0,
        deadline_ms: 0,
        remaining_ms: 0,
        status: 'running',
        started_at: timestamp,
        updated_at: timestamp,
        order,
    };
    records.set(key, record);
    if (!latestKeyByWorkstream.has(workstreamId)) latestKeyByWorkstream.set(workstreamId, key);
    return record;
}

/**
 * Rebuilds the workstream list from a message stream. Active workstreams sort first
 * in launch order, settled ones after in most-recently-updated order.
 */
export function deriveWorkstreamsFromMessages(messages: AgentMessage[]): WorkstreamInfo[] {
    const records = new Map<string, DerivedWorkstreamInfo>();
    const latestKeyByWorkstream = new Map<string, string>();

    messages.forEach((message, order) => {
        const timestamp = getTimestampMs(message.timestamp);
        const details = getWorkstreamMessageDetails(message);
        const launchDetails = getWorkstreamLaunchDetails(message);
        const workstreamId = launchDetails?.workstreamId ?? details?.workstreamId;
        if (!workstreamId) return;

        const launchId = launchDetails?.launchId ?? details?.launchId;
        const isInternalResult = isWorkstreamInternalResultMessage(message);
        if (!launchDetails && !launchId && isInternalResult && !latestKeyByWorkstream.has(workstreamId)) return;

        const record = ensureWorkstreamRecord(records, latestKeyByWorkstream, workstreamId, launchId, timestamp, order);

        if (launchDetails) {
            record.interaction = launchDetails.interaction ?? record.interaction;
            record.child_workflow_id = launchDetails.childWorkflowId ?? record.child_workflow_id;
            record.child_workflow_run_id = launchDetails.childWorkflowRunId ?? record.child_workflow_run_id;
            record.status = 'running';
        } else {
            record.interaction = details?.interaction ?? record.interaction;
            record.child_workflow_id = details?.childWorkflowId ?? record.child_workflow_id;
            record.child_workflow_run_id = details?.childWorkflowRunId ?? record.child_workflow_run_id;
        }

        const lifecycleStatus = getWorkstreamLifecycleStatus(message);
        if (lifecycleStatus) {
            record.status = lifecycleStatus;
        } else if (!isInternalResult) {
            if (isWorkstreamActivityFailureMessage(message)) {
                record.status = 'failed';
            } else if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
                record.status = 'completed';
            }
        }

        if (isInternalResult) return;

        record.updated_at = Math.max(record.updated_at, timestamp);
        if (isActiveWorkstreamStatus(record.status)) {
            record.elapsed_ms = Math.max(record.elapsed_ms, timestamp - record.started_at);
        } else {
            record.elapsed_ms = Math.max(record.elapsed_ms, timestamp - record.started_at);
            record.remaining_ms = 0;
        }
    });

    return Array.from(records.values())
        .sort((a, b) => {
            const activeDelta =
                Number(!isActiveWorkstreamStatus(a.status)) - Number(!isActiveWorkstreamStatus(b.status));
            if (activeDelta !== 0) return activeDelta;
            if (isActiveWorkstreamStatus(a.status)) return a.order - b.order;
            return b.updated_at - a.updated_at || a.order - b.order;
        })
        .map(({ started_at, updated_at, order, ...workstream }) => workstream);
}

/** Adapts a running entry from the `getActiveWorkstreams` query to {@link WorkstreamInfo}. */
export function activeWorkstreamEntryToInfo(ws: ActiveWorkstreamEntry): WorkstreamInfo {
    return {
        workstream_id: ws.workstream_id,
        launch_id: ws.launch_id,
        interaction: ws.interaction,
        elapsed_ms: ws.elapsed_ms,
        deadline_ms: ws.deadline_ms,
        remaining_ms: Math.max(0, ws.deadline_ms - ws.elapsed_ms),
        status: ws.status,
        phase: ws.latest_progress?.phase,
        child_workflow_id: ws.child_workflow_id,
        child_workflow_run_id: ws.child_workflow_run_id,
    };
}

/** Adapts a completed entry from the `getActiveWorkstreams` query to {@link WorkstreamInfo}. */
export function completedWorkstreamEntryToInfo(ws: CompletedWorkstreamEntry): WorkstreamInfo {
    return {
        workstream_id: ws.workstream_id,
        launch_id: ws.launch_id,
        interaction: ws.interaction,
        elapsed_ms: ws.duration_ms ?? 0,
        deadline_ms: 0,
        remaining_ms: 0,
        status: ws.status,
        phase: ws.last_progress?.phase,
        child_workflow_id: ws.child_workflow_id,
        child_workflow_run_id: ws.child_workflow_run_id,
    };
}

/**
 * Folds `next` into `workstreams` in place, matching on `launch_id` and falling back to
 * the placeholder record that {@link deriveWorkstreamsFromMessages} creates before a
 * launch id is known.
 */
export function mergeWorkstreamInfo(workstreams: WorkstreamInfo[], next: WorkstreamInfo) {
    const existingIndex = workstreams.findIndex((ws) => ws.launch_id === next.launch_id);
    if (existingIndex >= 0) {
        workstreams[existingIndex] = mergePreservingTerminalStatus(workstreams[existingIndex], next);
        return;
    }

    const fallbackIndex = workstreams.findIndex(
        (ws) => ws.workstream_id === next.workstream_id && ws.launch_id.startsWith('message-derived:'),
    );
    if (fallbackIndex >= 0 && !next.launch_id.startsWith('message-derived:')) {
        workstreams[fallbackIndex] = mergePreservingTerminalStatus(workstreams[fallbackIndex], next);
        return;
    }

    workstreams.push(next);
}
