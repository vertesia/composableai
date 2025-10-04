import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface DeleteDocumentsParams {
    documentIds: string[];
}

export interface DeleteDocumentsResult {
    deletedCount: number;
    deletedIds: string[];
    errors: Array<{ id: string; error: string }>;
}

export interface DeleteDocuments extends DSLActivitySpec<DeleteDocumentsParams> {
    name: 'deleteDocuments';
    projection?: never;
}

/**
 * Delete multiple documents from the store
 * @param payload - Contains the list of document IDs to delete
 * @returns Result with deleted count, IDs, and any errors encountered
 */
export async function deleteDocuments(
    payload: DSLActivityExecutionPayload<DeleteDocumentsParams>
): Promise<DeleteDocumentsResult> {
    const { client, params } = await setupActivity<DeleteDocumentsParams>(payload);
    const { documentIds } = params;

    log.info(`Deleting ${documentIds.length} documents`);

    const deletedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const id of documentIds) {
        try {
            await client.objects.delete(id);
            deletedIds.push(id);
            log.info(`Deleted document: ${id}`);
        } catch (error: any) {
            log.error(`Failed to delete document ${id}: ${error.message}`);
            errors.push({ id, error: error.message });
        }
    }

    log.info(`Deleted ${deletedIds.length} of ${documentIds.length} documents${errors.length > 0 ? ` (${errors.length} failed)` : ''}`);

    return {
        deletedCount: deletedIds.length,
        deletedIds,
        errors
    };
}
