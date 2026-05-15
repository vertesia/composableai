import type { AgentRunStatus } from '@vertesia/common';

export type SortField = 'topic' | 'agent' | 'status' | 'started';

export const SORT_FIELD_MAP: Record<SortField, string> = {
    topic: 'topic',
    agent: 'interaction',
    status: 'status',
    started: 'started_at',
};

export const PAGE_SIZE = 100;

export const STATUS_VALUES: AgentRunStatus[] = [
    'created',
    'running',
    'completed',
    'failed',
    'cancelled',
];

export type FilterableField = 'status' | 'agent';

export type BadgeVariant =
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'attention'
    | 'success'
    | 'info'
    | 'done';
