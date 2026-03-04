import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { DocPart } from "../utils/chunks.js";
import { InteractionExecutionParams, executeInteractionFromActivity } from "./executeInteraction.js";

const INT_CHUNK_DOCUMENT = "sys:ChunkDocument"



export interface ChunkDocumentResult {
    id: string
    status: "completed" | "failed" | "skipped"
    parts?: string[]
    message?: string
}

export interface ChunkDocumentParams extends InteractionExecutionParams {

    /**
     * If true, force chunking even if the document is already chunked
     */
    force?: boolean;

    /**
     * The interaction name to use for chunking
     * If not set, the default interaction will be used
     */
    interactionName?: string;

    /**
     * The object type to use for the document parts
     * If not set, the type of the document will be used
     */
    docPartType?: string;

    /**
     * If true, create parts as document objects
     */
    createParts?: boolean;
}

export interface ChunkDocument extends DSLActivitySpec<ChunkDocumentParams> {
    name: 'chunkDocument';
}


export async function chunkDocument(payload: DSLActivityExecutionPayload<ChunkDocumentParams>): Promise<ChunkDocumentResult> {
    const { params, client, objectId } = await setupActivity<ChunkDocumentParams>(payload);

    const { force } = params;
    const interactionName = params.interactionName ?? INT_CHUNK_DOCUMENT;

    log.info(`Object ${objectId} chunking started`);

    const document = await client.objects.retrieve(objectId, "+text");

    const type = document.type
        ? await client.types.catalog.resolve(document.type)
        : undefined;

    if (!type?.is_chunkable) {
        log.warn('Type is not chunkable for object ID: ' + objectId);
        return { id: objectId, status: "skipped", message: "type not chunkable" }
    }

    //check if text is present
    if (!document.text) {
        log.warn('No text found for object ID: ' + objectId);
        return { id: objectId, status: "failed", message: "no text found" }
    }

    if (!force && document.parts && document.parts.length > 0 && document.parts_etag === document.text_etag) {
        log.info('Document already chunked for object ID: ' + objectId);
        return { id: objectId, status: "skipped", message: "document already chunked with correct etag" }
    }

    //instrument the text with line numbers
    const lines = document.text.split('\n')
    const instrumented = lines.map((l, i) => `{%${i}%}${l}`).join('\n')

    const res = await executeInteractionFromActivity(client, interactionName, params, {
        objectId: objectId,
        content: instrumented
    });

    const jsonResult = res.result.object();

    const parts = jsonResult.parts as DocPart[];
    if (!parts || parts.length === 0) {
        log.warn('No parts found for object ID: ' + objectId, res);
        return { id: objectId, status: "failed", parts: [], message: "no parts found" }
    }


    /**
     * Only create parts as document if the flag is set
     */
    if (params.createParts) {

        const partDocs = await Promise.all(parts.map(async (part, i) => {

            const text = lines.filter((_l, i) => i >= part.line_number_start && i <= part.line_number_end).join('\n');

            const location = () => {
                let location = document.location;
                if (location.endsWith('/')) {
                    location += document.name + "/" + part.type
                }
                location += '/' + document.name + "/" + part.type;
                return location;
            }

            const docPart = await client.objects.create({
                name: part.name,
                parent: objectId,
                text: text,
                location: location(),
                properties: {
                    part_number: i + 1,
                    etag: document.text_etag,
                    source_line_start: part.line_number_start,
                    source_line_end: part.line_number_end,
                    title: part.name
                }
            });
            return docPart;
        }));

        //delete previous parts
        if (document.parts && document.parts.length > 0) {
            log.info('Deleting previous parts for object ID: ' + objectId, { parts: document.parts });
            await Promise.all(document.parts.map(async (partId) => {
                await client.objects.delete(partId);
            }));
        }

        await client.objects.update(objectId, {
            parts: partDocs.map(p => p.id),
            parts_etag: document.text_etag
        });
    }

    log.info(`Object ${objectId} chunking completed`, { parts: document.parts });

    return { id: objectId, status: "completed", parts: document.parts }

}