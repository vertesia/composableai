import { log } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec, RenditionProperties } from "@vertesia/common";
import fs from 'fs';
import sharp, { FormatEnum } from "sharp";
import { imageResizer } from "../conversion/image.js";
import { pdfToImages } from "../conversion/mutool.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound, WorkflowParamNotFound } from "../errors.js";
import { fetchBlobAsBuffer, saveBlobToTempFile } from "../utils/blobs.js";
interface GenerateImageRenditionParams {
    max_hw: number; //maximum size of the longuest side of the image
    format: keyof FormatEnum; //format of the output image
    multi_page?: boolean; //if true, generate a multi-page rendition
}


export interface GenerateImageRendition extends DSLActivitySpec<GenerateImageRenditionParams> {

    name: 'generateImageRendition';

}


export async function generateImageRendition(payload: DSLActivityExecutionPayload<GenerateImageRenditionParams>) {
    const { client, objectId, params } = await setupActivity<GenerateImageRenditionParams>(payload);

    const supportedNonImageInputTypes = ['application/pdf']
    const inputObject = await client.objects.retrieve(objectId).catch((err) => {
        log.error(`Failed to retrieve document ${objectId}`, err);
        if (err.response?.status === 404) {
            throw new NoDocumentFound(`Document ${objectId} not found`, [objectId]);
        }
        throw err;
    });
    const renditionType = await client.types.getTypeByName('Rendition');

    if (!params.format) {
        log.error(`Format not found`);
        throw new WorkflowParamNotFound(`format`);
    }

    if (!renditionType) {
        log.error(`Rendition type not found`);
        throw new NoDocumentFound(`Rendition type not found`, [objectId]);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new NoDocumentFound(`Document ${objectId} has no source`, [objectId]);
    }

    if (!inputObject.content.type || (!inputObject.content.type?.startsWith('image/') && !supportedNonImageInputTypes.includes(inputObject.content.type))) {
        log.error(`Document ${objectId} is not an image`);
        throw new NoDocumentFound(`Document ${objectId} is not an image or pdf: ${inputObject.content.type}`, [objectId]);
    }

    //array of rendition files to upload
    let renditionPages: string[] = [];

    //if PDF, convert to pages
    if (inputObject.content.type === 'application/pdf') {
        const pdfBuffer = await fetchBlobAsBuffer(client, inputObject.content.source);
        const pages = await pdfToImages(pdfBuffer);
        if (!pages.length) {
            log.error(`Failed to convert pdf to image`);
            throw new Error(`Failed to convert pdf to image`);
        }
        renditionPages = [...pages];
    } else if (inputObject.content.type.startsWith('image/')) {
        const tmpFile = await saveBlobToTempFile(client, inputObject.content.source);
        const filestats = fs.statSync(tmpFile);
        log.info(`Image ${objectId} copied to ${tmpFile}`, { filestats });
        renditionPages.push(tmpFile);
    }

    //generate rendition name, pass an index for multi parts
    const getRenditionName = (index: number = 0) => {
        const name = `renditions/${objectId}/${params.max_hw}/${index}.${params.format}`;
        return name;
    }

    if (!renditionPages || !renditionPages.length) {
        log.error(`Failed to generate rendition for ${objectId}`);
        throw new Error(`Failed to generate rendition for ${objectId}`);
    }

    log.info(`Uploading rendition for ${objectId} with ${renditionPages.length} pages (max_hw: ${params.max_hw}, format: ${params.format})`, { renditionPages });
    const uploads = renditionPages.map(async (page, i) => {
        const pageId = getRenditionName(i);
        const resized = sharp(page).pipe(imageResizer(params.max_hw, params.format));

        const source = new NodeStreamSource(
            resized,
            pageId.replace('renditions/', '').replace('/', '_'),
            'image/' + params.format,
            pageId,
        )

        log.info(`Uploading rendition for ${objectId} page ${i} with max_hw: ${params.max_hw} and format: ${params.format}`);
        return client.objects.upload(source).catch((err) => {
            log.error(`Failed to upload rendition for ${objectId} page ${i}`, err);
            return Promise.resolve(null);
        });
    });

    const uploaded = await Promise.all(uploads);
    if (!uploaded || !uploaded.length || !uploaded[0]) {
        log.error(`Failed to upload rendition for ${objectId}`);
        throw new Error(`Failed to upload rendition for ${objectId}`);
    }


    log.info(`Creating rendition for ${objectId} with max_hw: ${params.max_hw} and format: ${params.format}`, { uploaded });
    const rendition = await client.objects.create({
        name: inputObject.name + ` [Rendition ${params.max_hw}]`,
        type: renditionType.id,
        parent: inputObject.id,
        content: uploaded[0],
        properties: {
            mime_type: 'image/' + params.format,
            source_etag: inputObject.content.source,
            height: params.max_hw,
            width: params.max_hw,
            multipart: uploaded.length > 1,
            total_parts: uploaded.length
        } satisfies RenditionProperties
    });

    log.info(`Rendition ${rendition.id} created for ${objectId}`, { rendition });

    return { id: rendition.id, format: params.format, status: "success" };

}
