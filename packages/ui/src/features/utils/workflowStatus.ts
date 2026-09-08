import { WorkflowExecutionStatus } from '@vertesia/common';

/**
 * Get the semantic color class for a workflow execution status.
 */
export function getWorkflowStatusColor(status?: WorkflowExecutionStatus): string {
    switch (status) {
        case WorkflowExecutionStatus.RUNNING:
            return 'text-info-foreground';
        case WorkflowExecutionStatus.COMPLETED:
            return 'text-success-foreground';
        case WorkflowExecutionStatus.FAILED:
            return 'text-destructive-foreground';
        case WorkflowExecutionStatus.TERMINATED:
        case WorkflowExecutionStatus.CANCELED:
            return 'text-attention-foreground';
        default:
            return 'text-muted-foreground';
    }
}

/**
 * Get a human-readable name for a workflow execution status.
 */
export function getWorkflowStatusName(status?: WorkflowExecutionStatus): string {
    switch (status) {
        case WorkflowExecutionStatus.RUNNING:
            return 'Running';
        case WorkflowExecutionStatus.COMPLETED:
            return 'Completed';
        case WorkflowExecutionStatus.FAILED:
            return 'Failed';
        case WorkflowExecutionStatus.CONTINUED_AS_NEW:
            return 'Continued As New';
        case WorkflowExecutionStatus.TERMINATED:
            return 'Terminated';
        case WorkflowExecutionStatus.TIMED_OUT:
            return 'Timed Out';
        case WorkflowExecutionStatus.CANCELED:
            return 'Canceled';
        default:
            return 'Unknown';
    }
}
