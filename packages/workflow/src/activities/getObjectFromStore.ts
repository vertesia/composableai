import type { DSLActivityExecutionPayload, DSLActivitySpec, ProjectedContentObjectApiResponse } from '@vertesia/common';
import { projectResult } from '../dsl/projections.js';
import { setupActivity } from '../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../errors.js';

export interface GetObjectParams {
    select?: string;
}

export interface GetObject extends DSLActivitySpec<GetObjectParams> {
    name: 'getObject';
}

type RetrievedContentObject = Omit<ProjectedContentObjectApiResponse, 'metadata'> & {
    metadata?: unknown;
};

function mergeProjection<T extends object>(object: T, projection: Partial<T>): T {
    return { ...object, ...projection };
}

/**
 * We are using a union type for the status parameter since typescript enums breaks the workflow code generation
 * @param objectId
 * @param status
 */
export async function getObjectFromStore(
    payload: DSLActivityExecutionPayload<GetObjectParams>,
): Promise<RetrievedContentObject> {
    const { client, params, objectId } = await setupActivity<GetObjectParams>(payload);

    let obj: RetrievedContentObject;
    try {
        obj = params.select
            ? await client.objects.retrieve(objectId, params.select)
            : await client.objects.retrieve(objectId);
    } catch (err: unknown) {
        const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
        if (status >= 400 && status < 500 && status !== 429) {
            throw new DocumentNotFoundError(`Object retrieval failed (${status}): ${objectId}`, [objectId]);
        }
        throw err;
    }

    const projection = projectResult(payload, params, obj, obj) as Partial<RetrievedContentObject>;

    return mergeProjection(obj, projection);
}
