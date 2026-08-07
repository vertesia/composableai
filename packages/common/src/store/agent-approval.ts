import type { z } from 'zod';
import type {
    AgentToolApprovalModeSchema,
    PendingToolApprovalResultsSchema,
    ToolApprovalGrantSchema,
} from '../api-schemas/interaction.js';

export const AgentToolApprovalModes = ['ask', 'auto_review', 'full_control'] as const;

export type AgentToolApprovalMode = z.infer<typeof AgentToolApprovalModeSchema>;

export type ToolApprovalGrant = z.infer<typeof ToolApprovalGrantSchema>;

export type PendingToolApprovalResults = z.infer<typeof PendingToolApprovalResultsSchema>;

export function normalizeAgentToolApprovalMode(
    mode: AgentToolApprovalMode | undefined,
    interactive: boolean | undefined,
): AgentToolApprovalMode {
    if (interactive !== true) {
        return 'full_control';
    }
    return mode ?? 'full_control';
}
