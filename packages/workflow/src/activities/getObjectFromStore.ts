import { ContentObject, DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { DocumentNotFoundError } from "../errors.js";
import { projectResult } from "../dsl/projections.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";


export interface GetObjectParams {
    select?: string;
}

export interface GetObject extends DSLActivitySpec<GetObjectParams> {
    name: 'getObject';
}

/**
 * We are using a union type for the status parameter since typescript enums breaks the workflow code generation
 * @param objectId
 * @param status
 */
export async function getObjectFromStore(payload: DSLActivityExecutionPayload<GetObjectParams>): Promise<ContentObject> {
    const { client, params, objectId } = await setupActivity<GetObjectParams>(payload);

    let obj: ContentObject;
    try {
        obj = await client.objects.retrieve(objectId, params.select);
    } catch (err: unknown) {
        const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
        if (status >= 400 && status < 500 && status !== 429) {
            throw new DocumentNotFoundError(`Object retrieval failed (${status}): ${objectId}`, [objectId]);
        }
        throw err;
    }

    const projection = projectResult(payload, params, obj, obj);

    return {
        ...projection,
        id: obj.id,
    }

}