import { log } from "@temporalio/activity";
import { DocumentMetadata, DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { InteractionExecutionParams, executeInteractionFromActivity } from "./executeInteraction.js";

const INT_GENERATE_TEXT_PARTS = "sys:IdentifyTextSections";
export interface identifyTextSectionsParams extends InteractionExecutionParams {
    interactionName?: string;
    chunkSize?: number;
    chunkOverlap?: number;
}
export interface identifyTextSections extends DSLActivitySpec<identifyTextSectionsParams> {
    name: "identifyTextSections";
}

function chunkInstrumentedText(instrumentedText: string, chunkSize: number, overlap: number): string[] {
    if (instrumentedText.length <= chunkSize) {
        return [instrumentedText];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < instrumentedText.length) {
        const end = Math.min(start + chunkSize, instrumentedText.length);
        const chunk = instrumentedText.substring(start, end);
        chunks.push(chunk);

        if (end === instrumentedText.length) break;
        start = end - overlap;
    }

    return chunks;
}

export async function identifyTextSections(
    payload: DSLActivityExecutionPayload<identifyTextSectionsParams>,
) {
    const context = await setupActivity<identifyTextSectionsParams>(payload);
    const { params, client, objectId } = context;
    const interactionName = params.interactionName ?? INT_GENERATE_TEXT_PARTS;
    const chunkSize = params.chunkSize ?? 10000;
    const chunkOverlap = params.chunkOverlap ?? 500;

    const project = await context.fetchProject();

    const doc = await client.objects.retrieve(objectId, "+text");

    const text = doc.text;
    if (!text || text.length === 0) {
        log.warn(`No text found for object ${objectId}`);
        return;
    }

    // Instrument the text with line numbers first
    const lines = text.split('\n');
    const instrumented = lines.map((l, i) => `{%${i}%}${l}`).join('\n');

    let allSections: any[] = [];

    if (instrumented.length <= chunkSize) {
        // Process as single chunk
        const promptData = {
            content: instrumented,
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
        if (parts && Array.isArray(parts) && parts.length > 0) {
            allSections.push(parts);
        }
    } else {
        // Chunk the instrumented text
        const chunks = chunkInstrumentedText(instrumented, chunkSize, chunkOverlap);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const promptData = {
                content: chunk,
                human_context: project?.configuration?.human_context ?? undefined,
            };

            try {
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
                console.log(JSON.stringify(parts, null, 2));
                if (parts && Array.isArray(parts) && parts.length > 0) {
                    allSections.push(...parts);
                }
            } catch (error) {
                log.warn(`Failed to process chunk ${i + 1}/${chunks.length} for object ${objectId}:`, { error });
            }
        }
    }

    if (allSections.length === 0) {
        log.warn(`No text parts generated for object ${objectId}`);
        return;
    }

    const existingMetadata = doc.metadata as DocumentMetadata | undefined;
    const updatedMetadata: DocumentMetadata = {
        type: "document",
        ...existingMetadata,
        generation_runs: existingMetadata?.generation_runs ?? [],
        sections: allSections
    };

    await client.objects.update(doc.id, {
        metadata: updatedMetadata,
    });

    return { status: "completed" };
}
