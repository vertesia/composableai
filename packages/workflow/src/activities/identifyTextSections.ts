import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { InteractionExecutionParams, executeInteractionFromActivity } from "./executeInteraction.js";

const INT_GENERATE_TEXT_PARTS = "sys:IdentifyTextSections";
export interface identifyTextSectionsParams extends InteractionExecutionParams {
    interactionName?: string;
}
export interface identifyTextSections extends DSLActivitySpec<identifyTextSectionsParams> {
    name: "identifyTextSections";
}

export async function identifyTextSections(
    payload: DSLActivityExecutionPayload<identifyTextSectionsParams>,
) {
    const context = await setupActivity<identifyTextSectionsParams>(payload);
    const { params, client, objectId } = context;
    const interactionName = params.interactionName ?? INT_GENERATE_TEXT_PARTS;

    const project = await context.fetchProject();

    const doc = await client.objects.retrieve(objectId, "+text");

    const text = doc.text;
    if (!text || text.length === 0) {
        log.warn(`No text found for object ${objectId}`);
        return;
    }

    //instrument the text with line numbers
    const lines = text.split('\n')
    const instrumented = lines.map((l, i) => `{%${i}%}${l}`).join('\n')

    const promptData = {
        content: instrumented ?? undefined,
        human_context: project?.configuration?.human_context ?? undefined,
    };

    const infoRes = await executeInteractionFromActivity(
        client,
        interactionName,
        {
            ...params,
            include_previous_error: true,
            validate_result: true,
        },
        promptData,
        payload.debug_mode ?? false,
    );

    const parts = infoRes.result.parts;
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
        log.warn(`No text parts generated for object ${objectId}`);
        return;
    }

    await client.objects.update(doc.id, {
        text_sections: parts,
    });

    return { status: "completed" };
}
