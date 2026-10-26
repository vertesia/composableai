import type * as Wire from '../wire-types.generated.js';

export const AgentToolApprovalModes = ['ask', 'auto_review', 'full_control'] as const;

export type AgentToolApprovalMode = Wire.AgentToolApprovalMode;

export type ToolApprovalGrant = Wire.ToolApprovalGrant;

export type PendingToolApprovalResults = Wire.PendingToolApprovalResults;

export function normalizeAgentToolApprovalMode(
    mode: AgentToolApprovalMode | undefined,
    interactive: boolean | undefined,
): AgentToolApprovalMode {
    if (interactive !== true) {
        return 'full_control';
    }
    return mode ?? 'full_control';
}
