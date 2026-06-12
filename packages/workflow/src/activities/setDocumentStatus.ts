import { log } from '@temporalio/activity';
import type { ContentObjectStatus, DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';

export interface SetDocumentStatusParams {
    status: ContentObjectStatus;
}

export interface SetDocumentStatus extends DSLActivitySpec<SetDocumentStatusParams> {
    name: 'setDocumentStatus';
    projection?: never;
}

/**
 * We are using a union type for the status parameter since typescript enums breaks the workflow code generation
 * @param objectId
 * @param status
 */
export async function setDocumentStatus(payload: DSLActivityExecutionPayload<SetDocumentStatusParams>) {
    const { client, params, objectId } = await setupActivity<SetDocumentStatusParams>(payload);

    try {
        const res = await client.objects.update(objectId, { status: params.status });
        return res.status;
    } catch (err: unknown) {
        // If document was deleted, nothing to update - log warning and continue
        const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
        const name = err instanceof Error ? err.name : undefined;
        if (status === 404 || name === 'ZenoClientNotFoundError') {
            log.warn(
                `Document ${objectId} not found - may have been deleted. Skipping status update to '${params.status}'`,
            );
            return undefined; // Signal that document wasn't found
        }
        throw err;
    }
}
