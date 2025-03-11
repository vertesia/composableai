import { log } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import fs from 'fs';
import { pdfExtractPages } from "../conversion/mutool.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound } from "../errors.js";
import { saveBlobToTempFile } from "../utils/blobs.js";

interface CreatePdfDocumentFromSourceParams {

    target_object_type: string; //type of the object to create
    title: string; //title of the object to create
    filename?: string; //filename of the object to create
    pages: number[]; //pages to extract into the new document
    parent?: string; //set the new document as child of the source document

}


export interface CreatePdfDocumentFromSource extends DSLActivitySpec<CreatePdfDocumentFromSourceParams> {
    name: 'createPdfDocumentFromSource';
}


/**
 * Create a new PDF by extrracting pages from a source PDF
 * @returns
 */
export async function createPdfDocumentFromSource(payload: DSLActivityExecutionPayload<CreatePdfDocumentFromSourceParams>) {
    const { client, objectId, params } = await setupActivity<CreatePdfDocumentFromSourceParams>(payload);
    const inputObject = await client.objects.retrieve(objectId);

    const { pages, filename, title } = params;
    log.info(`Creating PDF from source`, { objectId, pages, filename, title });

    if (!pages || pages.length === 0) {
        log.error(`No pages provided`);
        throw new Error(`No pages provided`);
    }

    if (!inputObject) {
        log.error(`Document ${objectId} not found`);
        throw new NoDocumentFound(`Document ${objectId} not found`, [objectId]);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new NoDocumentFound(`Document ${objectId} has no source`, [objectId]);
    }

    if (!inputObject.content.type || (!inputObject.content.type?.startsWith('application/pdf'))) {
        log.error(`Document ${objectId} is not an image`);
        throw new NoDocumentFound(`Document ${objectId} is not an image or pdf: ${inputObject.content.type}`, [objectId]);
    }

    const targetType = await client.types.getTypeByName(params.target_object_type);
    if (!targetType) {
        log.error(`Type ${params.target_object_type} not found`);
        throw new NoDocumentFound(`Type ${params.target_object_type} not found`);
    }

    const tmpFile = await saveBlobToTempFile(client, inputObject.content.source, ".pdf");
    const newPdf = await pdfExtractPages(tmpFile, pages);
    log.info(`PDF created from pages ${pages.join(', ')} `, { newPdf });
    const name = `pages-${pages.join('-')}.pdf`;

    const sourceToUpload = new NodeStreamSource(
        fs.createReadStream(newPdf),
        name,
        "application/pdf"
    )

    log.info(`Uploading file ${newPdf} `);
    const upload = await client.objects.upload(sourceToUpload);
    log.info(`File uploaded ${upload.source} `);

    const newObject = await client.objects.create({
        type: targetType.id,
        name: title || targetType.name,
        parent: objectId,
        content: {
            source: upload.source,
            name: upload.name,
            type: 'application/pdf'
        }
    });

    return { newObjectId: newObject.id, uploadedFile: upload.name };


}
