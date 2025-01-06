import { ContentObjectStatus, DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

export interface SetDocumentStatusParams {
    status: ContentObjectStatus;
}

export interface SetDocumentStatus extends DSLActivitySpec<SetDocumentStatusParams> {
    name: 'setDocumentStatus';
    projection?: never;
}

/**
 * We are using a union type for the status parameter since typescript enumbs breaks the workflow code generation
 * @param objectId
 * @param status
 */
export async function setDocumentStatus(payload: DSLActivityExecutionPayload) {
    const { client, params, objectId } = await setupActivity<SetDocumentStatusParams>(payload);

    const res = await client.objects.update(objectId, { status: params.status });

    return res.status;

}