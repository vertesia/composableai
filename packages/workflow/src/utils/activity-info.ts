import { activityInfo, type Info } from '@temporalio/activity';

/**
 * Temporal SDK 1.17 changed {@link Info.workflowExecution} to be optional.
 * Inside an activity it is always populated, so this asserts its presence and
 * returns it, letting callers read `runId` / `workflowId` without unsafe access
 * on a possibly-undefined value.
 */
export function activityWorkflowExecution(info: Info = activityInfo()) {
    const execution = info.workflowExecution;
    if (!execution) {
        throw new Error('Activity is running without workflowExecution info');
    }
    return execution;
}

/**
 * Whether Temporal will run this activity again after `error`: the failure is retryable and the
 * retry policy has attempts left. Unknown (no `maximumAttempts`) counts as no retry, so a caller
 * logging the last failure keeps it visible.
 */
export function activityWillRetry(error: unknown, info: Info = activityInfo()): boolean {
    const failure = error as { nonRetryable?: unknown; retryable?: unknown } | undefined;
    if (failure?.nonRetryable === true || failure?.retryable === false) return false;
    const maximumAttempts = info.retryPolicy?.maximumAttempts;
    return typeof maximumAttempts === 'number' && maximumAttempts > 0 && info.attempt < maximumAttempts;
}
