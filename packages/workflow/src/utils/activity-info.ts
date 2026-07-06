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
