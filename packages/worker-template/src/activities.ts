import { log } from "@temporalio/activity";
import { WorkflowExecutionPayload } from "@vertesia/common";
import { getVertesiaClient } from "@vertesia/workflow";

/**
 * Extended payload interface for activities that need additional parameters
 * beyond the standard workflow execution payload.
 */
export interface ActivityExecutionPayload<T> extends WorkflowExecutionPayload<ExampleWorkflowParams> {
    params: T;
}

/**
 * Parameters for the example workflow.
 * Customize these based on your workflow requirements.
 */
export interface ExampleWorkflowParams {
    dryRun?: boolean;
}

/**
 * Parameters for processing a single content object.
 */
export interface ProcessObjectParams {
    objectId: string;
}

/**
 * Result returned from processing an object.
 */
export interface ProcessObjectResult {
    objectId: string;
    name: string;
    success: boolean;
    message?: string;
}

/**
 * Example activity that retrieves and processes a content object from Vertesia.
 *
 * This demonstrates the pattern for:
 * - Getting the Vertesia client from the workflow payload
 * - Making API calls to the Vertesia platform
 * - Supporting dry-run mode for testing
 * - Proper error handling and logging
 *
 * @param payload - The activity execution payload containing auth and params
 * @returns The result of processing the object
 */
export async function processObjectActivity(
    payload: ActivityExecutionPayload<ProcessObjectParams>
): Promise<ProcessObjectResult> {
    const { params, vars = {} } = payload;
    const { objectId } = params;

    log.info(`Processing object: ${objectId}`);

    // Get the Vertesia client initialized with auth from the payload
    const vertesia = getVertesiaClient(payload);

    // Retrieve the content object
    const object = await vertesia.objects.retrieve(objectId);

    if (vars.dryRun) {
        log.info(`Dry run: would process object "${object.name}"`);
        return {
            objectId,
            name: object.name,
            success: true,
            message: "Dry run - no changes made",
        };
    }

    // Add your processing logic here
    // For example: analyze content, update metadata, trigger other workflows, etc.

    log.info(`Successfully processed object: ${object.name}`);

    return {
        objectId,
        name: object.name,
        success: true,
    };
}

/**
 * Example activity that fetches and returns object metadata.
 *
 * This is a simpler activity that just retrieves information
 * without making changes - useful for validation or inspection workflows.
 *
 * @param payload - The activity execution payload
 * @returns Object metadata
 */
export async function getObjectMetadataActivity(
    payload: ActivityExecutionPayload<ProcessObjectParams>
): Promise<{ objectId: string; name: string; type?: string; properties: Record<string, unknown> }> {
    const { params } = payload;
    const { objectId } = params;

    log.info(`Fetching metadata for object: ${objectId}`);

    const vertesia = getVertesiaClient(payload);
    const object = await vertesia.objects.retrieve(objectId);

    return {
        objectId: object.id,
        name: object.name,
        type: object.type?.name,
        properties: object.properties || {},
    };
}
