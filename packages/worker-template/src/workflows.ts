import { log, proxyActivities } from '@temporalio/workflow';
import { WorkflowExecutionPayload } from '@vertesia/common';
import * as activities from './activities.js';
import { ExampleWorkflowParams, ProcessObjectResult } from './activities.js';

/**
 * Proxy activities with retry configuration.
 *
 * Temporal activities are executed outside the workflow sandbox and can perform
 * I/O operations like API calls. The proxy configuration defines:
 * - startToCloseTimeout: Maximum time for a single activity attempt
 * - retry: Automatic retry behavior for transient failures
 */
const { processObjectActivity, getObjectMetadataActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minute',
    retry: {
        initialInterval: '5s',
        backoffCoefficient: 2,
        maximumAttempts: 5,
        maximumInterval: 30 * 1000, // ms
        nonRetryableErrorTypes: ['ActivityParamInvalid', 'ActivityParamNotFound'],
    },
});

/**
 * Result returned from the example workflow.
 */
export interface ExampleWorkflowResult {
    processedObjects: number;
    results: ProcessObjectResult[];
}

/**
 * Example workflow that processes content objects from Vertesia.
 *
 * This workflow demonstrates:
 * - Receiving the standard WorkflowExecutionPayload with objectIds
 * - Processing multiple objects through activities
 * - Aggregating results
 * - Using workflow variables (vars) for configuration
 *
 * The workflow is triggered with:
 * - objectIds: Array of content object IDs to process
 * - vars: Optional configuration like { dryRun: true }
 *
 * @param payload - The workflow execution payload from Vertesia
 * @returns Summary of processed objects
 */
export async function exampleWorkflow(
    payload: WorkflowExecutionPayload<ExampleWorkflowParams>
): Promise<ExampleWorkflowResult> {
    const { objectIds = [] } = payload;

    log.info(`Starting example workflow with ${objectIds.length} objects`);

    const results: ProcessObjectResult[] = [];

    // Process each object sequentially
    // For parallel processing, you can use Promise.all with child workflows
    for (const objectId of objectIds) {
        const result = await processObjectActivity({
            ...payload,
            params: { objectId },
        });
        results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    log.info(`Workflow completed: ${successCount}/${objectIds.length} objects processed successfully`);

    return {
        processedObjects: results.length,
        results,
    };
}

/**
 * Example workflow that inspects objects without modifying them.
 *
 * This is useful for validation, reporting, or audit workflows
 * that need to gather information about content objects.
 *
 * @param payload - The workflow execution payload from Vertesia
 * @returns Metadata for all requested objects
 */
export async function inspectObjectsWorkflow(
    payload: WorkflowExecutionPayload<ExampleWorkflowParams>
): Promise<{ objects: Array<{ objectId: string; name: string; type?: string; properties: Record<string, unknown> }> }> {
    const { objectIds = [] } = payload;

    log.info(`Inspecting ${objectIds.length} objects`);

    const objects = [];

    for (const objectId of objectIds) {
        const metadata = await getObjectMetadataActivity({
            ...payload,
            params: { objectId },
        });
        objects.push(metadata);
    }

    return { objects };
}
