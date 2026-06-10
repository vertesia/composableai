import type { AgentMessage } from '@vertesia/common';

export interface WorkstreamInfo {
    workstream_id: string;
    launch_id: string;
    elapsed_ms: number;
    deadline_ms: number;
    remaining_ms: number;
    status: 'running' | 'canceling' | 'completed' | 'canceled' | 'failed' | 'timeout';
    phase?: string;
    child_workflow_id?: string;
    child_workflow_run_id?: string;
}

export interface WorkstreamLaunchDetails {
    workstreamId: string;
    launchId?: string;
    kind?: string;
    interaction?: string;
    childWorkflowId?: string;
    childWorkflowRunId?: string;
}

export function formatWorkstreamName(workstreamId: string) {
    const normalized = workstreamId
        .replace(/^workstream[:_-]?/i, '')
        .replace(/[:_-]+/g, ' ')
        .trim();

    if (!normalized) return workstreamId;

    return normalized
        .split(/\s+/)
        .map((part) => {
            const lower = part.toLowerCase();
            if (lower === 'qa') return 'QA';
            if (lower === 'ui') return 'UI';
            if (lower === 'api') return 'API';
            if (lower === 'url') return 'URL';
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

export function getWorkstreamStatusClass(status: WorkstreamInfo['status']) {
    switch (status) {
        case 'running':
            return 'bg-info';
        case 'canceling':
            return 'bg-attention';
        case 'completed':
            return 'bg-success';
        case 'canceled':
        case 'failed':
        case 'timeout':
            return 'bg-destructive';
    }
}

export function getWorkstreamLifecycleStatus(message: AgentMessage): WorkstreamInfo['status'] | undefined {
    const details = message.details as
        | {
              status?: unknown;
              workstream_event?: unknown;
          }
        | undefined;

    const status = details?.status;
    if (
        status === 'running' ||
        status === 'canceling' ||
        status === 'completed' ||
        status === 'canceled' ||
        status === 'failed' ||
        status === 'timeout'
    ) {
        return status;
    }

    if (details?.workstream_event === 'completed') return 'completed';
    return undefined;
}

export function isWorkstreamTerminalMessage(message: AgentMessage): boolean {
    const status = getWorkstreamLifecycleStatus(message);
    if (status === 'completed' || status === 'canceled' || status === 'failed' || status === 'timeout') return true;
    return false;
}

export function getWorkstreamLaunchDetails(message: AgentMessage): WorkstreamLaunchDetails | null {
    const details = message.details as
        | {
              workstream_event?: unknown;
              workstream_id?: unknown;
              launch_id?: unknown;
              kind?: unknown;
              interaction?: unknown;
              child_workflow_id?: unknown;
              child_workflow_run_id?: unknown;
          }
        | undefined;

    if (details?.workstream_event !== 'launched') return null;

    const workstreamId =
        typeof details.workstream_id === 'string'
            ? details.workstream_id
            : typeof message.workstream_id === 'string'
              ? message.workstream_id
              : '';

    if (!workstreamId || workstreamId === 'main' || workstreamId === 'all') return null;

    return {
        workstreamId,
        launchId: typeof details.launch_id === 'string' ? details.launch_id : undefined,
        kind: typeof details.kind === 'string' ? details.kind : undefined,
        interaction: typeof details.interaction === 'string' ? details.interaction : undefined,
        childWorkflowId: typeof details.child_workflow_id === 'string' ? details.child_workflow_id : undefined,
        childWorkflowRunId:
            typeof details.child_workflow_run_id === 'string' ? details.child_workflow_run_id : undefined,
    };
}
