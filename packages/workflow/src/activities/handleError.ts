import { log } from '@temporalio/activity';
import { ContentObjectStatus, type DSLActivityExecutionPayload } from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';

export interface HandleDslErrorParams {
    errorMessage: string;
}

export async function handleDslError(payload: DSLActivityExecutionPayload<HandleDslErrorParams>): Promise<void> {
    const { client, params, objectId } = await setupActivity<HandleDslErrorParams>(payload);

    const isIntake = [
        'StandardDocumentIntake',
        'StandardImageIntake',
        'StandardMediaContainerIntake',
        'StandardVideoIntake',
        'StandardAudioIntake',
        'StandardDocPartIntake',
    ].includes(payload.workflow_name);
    if (!isIntake) {
        log.warn(
            `Workflow execution failed, but no error handler registered for this workflow: ${payload.workflow_name}`,
            { error: params.errorMessage },
        );
        return;
    }

    try {
        await client.objects.update(objectId, { status: ContentObjectStatus.failed });
    } catch (e) {
        // Recovery path: the upstream workflow has already failed (and that
        // original error is logged by the completion interceptor). What's
        // happening here is that we *also* couldn't mark the content object
        // as failed. Stay at error so it remains in dashboards — recurring
        // recovery failures are a real signal — but enrich the message so
        // it's clearly distinct from the upstream error rather than reading
        // like a duplicate.
        log.error(`Recovery failed: could not update object ${objectId} status to failed`, {
            error: e,
            upstreamError: params.errorMessage,
            workflow_name: payload.workflow_name,
        });
    }
    return;
}
