import { activityInfo } from "@temporalio/activity";
import { AgentMessageType, DSLActivityExecutionPayload } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface PostUpdateMessageParams {
    type: string;
    message: string;
    details?: any;
    workstream_id?: string;
    timestamp?: number;
    workflow_run_id?: string;
}

export async function postUpdateMessage(payload: DSLActivityExecutionPayload<PostUpdateMessageParams>) {
    const { params, client: vertesia } = await setupActivity(payload);
    const { message, type, details, workstream_id } = params;
    const { runId } = activityInfo().workflowExecution;

    // Use parent run_id if available, otherwise use current runId
    const updateChannelId = payload.parent?.run_id ?? runId;

    // Send to vertesia's channel
    const timestamp = Date.now();
    await vertesia.workflows.postMessage(updateChannelId, {
        workflow_run_id: updateChannelId,
        timestamp,
        message,
        type: (type as AgentMessageType) ?? AgentMessageType.UPDATE,
        details,
        workstream_id: workstream_id,
    });
}
