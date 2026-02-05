import { log } from "@temporalio/activity";
import { InteractionOutput } from "@vertesia/client";
import { CreateContentObjectTypePayload, DSLActivityExecutionPayload, DSLActivitySpec, ExecutionRun } from "@vertesia/common";
import { projectResult } from "../../dsl/projections.js";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { ActivityParamNotFoundError } from "../../errors.js";


export interface CreateDocumentTypeFromInteractionRunParams {
    /**
     * The execution run object to use. Required.
     * Not required in params since it is usually fetched
     */
    run: ExecutionRun,
    /**
     * If defined then update the object type with the created type
     */
    updateObjectId?: string;
}

export interface CreateDocumentTypeFromInteractionRun extends DSLActivitySpec<CreateDocumentTypeFromInteractionRunParams> {
    name: 'createDocumentTypeFromInteractionRun';
}

export async function createDocumentTypeFromInteractionRun(payload: DSLActivityExecutionPayload<CreateDocumentTypeFromInteractionRunParams>) {
    const { params, client } = await setupActivity<CreateDocumentTypeFromInteractionRunParams>(payload);

    if (!params.run) {
        throw new ActivityParamNotFoundError("run", payload.activity);
    }

    const jsonResult = InteractionOutput.from(params.run.result).object();

    if (!jsonResult.document_type) {
        log.error("No name generated for type: " + JSON.stringify(jsonResult), jsonResult);
        throw new Error("No name generated for type");
    }

    log.info("Generated schema for type", jsonResult.metadata_schema);
    const typeData: CreateContentObjectTypePayload = {
        name: jsonResult.document_type,
        object_schema: jsonResult.metadata_schema,
        is_chunkable: !!jsonResult.is_chunkable,
    }

    const type = await client.types.create(typeData);

    if (params.updateObjectId) {
        await client.objects.update(params.updateObjectId, {
            type: type.id,
        });
    }

    return projectResult(payload, params, type, { id: type.id, name: type.name });
}