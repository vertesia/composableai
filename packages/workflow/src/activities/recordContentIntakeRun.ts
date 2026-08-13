import type {
    ContentIntakeRun,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    RecordContentIntakeRunPayload,
} from '@vertesia/common';
import { setupActivity } from '../dsl/setup/ActivityContext.js';

export interface RecordContentIntakeRunParams {
    status: ContentIntakeRun['status'];
    started_at: string;
    completed_at?: string;
    completeness: ContentIntakeRun['completeness'];
}

export interface RecordContentIntakeRun extends DSLActivitySpec<RecordContentIntakeRunParams> {
    name: 'recordContentIntakeRun';
    projection?: never;
}

export async function recordContentIntakeRun(
    payload: DSLActivityExecutionPayload<RecordContentIntakeRunParams>,
): Promise<ContentIntakeRun> {
    const { client, params, objectId } = await setupActivity<RecordContentIntakeRunParams>(payload);
    if (!payload.root_workflow) {
        throw new Error('root_workflow is required to record content intake attribution');
    }
    const record: RecordContentIntakeRunPayload = {
        root_workflow_id: payload.root_workflow.workflow_id,
        root_workflow_run_id: payload.root_workflow.run_id,
        root_workflow_type: payload.root_workflow.workflow_type,
        status: params.status,
        started_at: params.started_at,
        completed_at: params.completed_at,
        completeness: params.completeness,
    };
    return client.objects.recordIntakeRun(objectId, record);
}
