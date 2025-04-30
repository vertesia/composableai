import { ContentObjectStatus, DSLActivityExecutionPayload } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { log } from "@temporalio/activity"

export interface HandleDslErrorParams {
    errorMessage: string;
}

export async function handleDslError(payload: DSLActivityExecutionPayload<HandleDslErrorParams>): Promise<void> {
    const { client, params, objectId } = await setupActivity<HandleDslErrorParams>(payload);
    const isIntake = payload.workflow_name === "StandardDocumentIntake" || payload.workflow_name === "StandardImageIntake";
    if (!isIntake) {
        log.warn(`Workflow execution failed, but no error handler registered for this workflow: ${payload.workflow_name}`,
            { error: params.errorMessage },
        );
        return;
    }

    try {
        await client.objects.update(objectId, { status: ContentObjectStatus.failed });
    } catch (e) {
        log.error("Failed to handle error", { error: e });
    }
    return;
}
