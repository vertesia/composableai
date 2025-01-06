import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { log } from "@temporalio/activity";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { TruncateSpec } from "../utils/tokens.js";
import { InteractionExecutionParams, executeInteractionFromActivity } from "./executeInteraction.js";

const INT_EXTRACT_INFORMATION = "sys:ExtractInformation"
export interface GenerateDocumentPropertiesParams extends InteractionExecutionParams {
    typesHint?: string[];
    /**
     * truncate the input doc text to the specified max_tokens
     */
    truncate?: TruncateSpec;

    interactionName?: string;

    use_vision?: boolean;
}
export interface GenerateDocumentProperties extends DSLActivitySpec<GenerateDocumentPropertiesParams> {
    name: 'generateDocumentProperties';
}

export async function generateDocumentProperties(payload: DSLActivityExecutionPayload) {
    const context = await setupActivity<GenerateDocumentPropertiesParams>(payload);
    const { params, client, objectId } = context;
    const interactionName = params.interactionName ?? INT_EXTRACT_INFORMATION;

    const project = await context.fetchProject();

    const doc = await client.objects.retrieve(objectId, "+text");
    const type = doc.type ? await client.types.retrieve(doc.type.id) : undefined;

    if (!doc?.text && !params.use_vision && !doc?.content?.type?.startsWith("image/")) {
        log.warn(`Object ${objectId} not found or text is empty`);
        return { status: "failed", error: "no-text" }
    }

    if (!type || !type.object_schema) {
        log.info(`Object ${objectId} has no schema`);
        return { document: objectId, status: "skipped", message: "no schema defined on type" };
    }

    const getImageRef = () => {
        if (doc.content?.type?.startsWith("image/")) {
            return "store:" + doc.id;
        }

        if (params.use_vision && doc.content?.type?.startsWith("application/pdf")) {
            return "store:" + doc.id;
        }

        log.info(`Object ${objectId} is not an image or pdf`);
        return undefined
    }

    const promptData = {
        content: doc.text ?? undefined,
        image: getImageRef() ?? undefined,
        human_context: project?.configuration?.human_context ?? undefined,
    }

    log.info(` Extracting information from object ${objectId} with type ${type.name}`, payload.debug_mode ? { params, } : undefined);

    const infoRes = await executeInteractionFromActivity(
        client,
        interactionName,
        {
            ...params,
            include_previous_error: true,
            result_schema: type.object_schema,
        },
        promptData,
        payload.debug_mode ?? false
    );

    log.info(`Extracted information from object ${objectId} with type ${type.name}`, { runId: infoRes.id });
    await client.objects.update(doc.id, {
        properties: {
            ...infoRes.result,
            etag: doc.text_etag
        },
        text: infoRes.result.description ?? undefined,
        generation_run_info: {
            id: infoRes.id,
            date: new Date().toISOString(),
            model: infoRes.modelId,
        }
    });


    return { status: "completed" };

}