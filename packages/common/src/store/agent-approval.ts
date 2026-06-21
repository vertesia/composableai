import type { ToolResult } from '../interaction.js';

export const AgentToolApprovalModes = ['ask', 'auto_review', 'full_control'] as const;

export type AgentToolApprovalMode = (typeof AgentToolApprovalModes)[number];

export interface ToolApprovalGrant {
    key: string;
    tool_name: string;
    target?: string;
    granted_at: string;
}

export interface PendingToolApprovalResults {
    results: ToolResult[];
    reason: 'denied' | 'timeout' | 'reviewer_denied';
    message: string;
    created_at: string;
}

export function normalizeAgentToolApprovalMode(
    mode: AgentToolApprovalMode | undefined,
    interactive: boolean | undefined,
): AgentToolApprovalMode {
    if (interactive !== true) {
        return 'full_control';
    }
    return mode ?? 'full_control';
}

export function isAgentToolApprovalMode(value: unknown): value is AgentToolApprovalMode {
    return typeof value === 'string' && (AgentToolApprovalModes as readonly string[]).includes(value);
}
