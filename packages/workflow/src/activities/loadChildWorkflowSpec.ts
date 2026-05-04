import { DSLActivityExecutionPayload, DSLWorkflowSpec } from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';

export interface LoadChildWorkflowSpecParams {
    workflowName: string;
}

export async function loadChildWorkflowSpec(
    payload: DSLActivityExecutionPayload<LoadChildWorkflowSpecParams>,
): Promise<DSLWorkflowSpec> {
    const { client, params } = await setupActivity<LoadChildWorkflowSpecParams>(payload);
    const { workflowName } = params;

    const refs = await client.store.workflows.definitions.list();
    const ref = refs.find(r => r.name === workflowName);
    if (!ref) {
        throw new Error(`Workflow definition not found: ${workflowName}`);
    }

    return client.store.workflows.definitions.retrieve(ref.id) as Promise<DSLWorkflowSpec>;
}
