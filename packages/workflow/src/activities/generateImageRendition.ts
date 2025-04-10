import { log } from "@temporalio/activity";
import { NodeStreamSource } from "@vertesia/client/node";
import { DSLActivityExecutionPayload, DSLActivitySpec, RenditionProperties } from "@vertesia/common";
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import os from 'os';
import { imageResizer } from "../conversion/image.js";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { NoDocumentFound, WorkflowParamNotFound } from "../errors.js";
import { saveBlobToTempFile } from "../utils/blobs.js";

interface GenerateImageRenditionParams {
    max_hw: number; //maximum size of the longuest side of the image
    format: string; //format of the output image
}

export interface GenerateImageRendition extends DSLActivitySpec<GenerateImageRenditionParams> {
    name: 'generateImageRendition';
}

export async function generateImageRendition(payload: DSLActivityExecutionPayload<GenerateImageRenditionParams>) {
    const { client, objectId, params } = await setupActivity<GenerateImageRenditionParams>(payload);

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

    if (!inputObject.content.type || (!inputObject.content.type?.startsWith('image/') && !inputObject.content.type?.startsWith('video/'))) {
        log.error(`Document ${objectId} is not an image or a video: ${inputObject.content.type}`);
        throw new NoDocumentFound(`Document ${objectId} is not an image or a video: ${inputObject.content.type}`, [objectId]);
    }

    //array of rendition files to upload
    let renditionPages: string[] = [];

    if (inputObject.content.type.startsWith('image/')) {
        const tmpFile = await saveBlobToTempFile(client, inputObject.content.source);
        const filestats = fs.statSync(tmpFile);
        log.info(`Image ${objectId} copied to ${tmpFile}`, { filestats });
        renditionPages.push(tmpFile);
    } else if (inputObject.content.type.startsWith('video/')) {
        const videoFile = await saveBlobToTempFile(client, inputObject.content.source);
        const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-rendition-'));
        const thumbnailPath = path.join(tempOutputDir, 'thumbnail.png');

        try {
            // Extract a frame at 10% of the video duration
            await new Promise<void>((resolve, reject) => {
                ffmpeg.ffprobe(videoFile, (err, metadata) => {
                    if (err) {
                        log.error(`Failed to probe video metadata: ${err.message}`);
                        return reject(err);
                    }

                    const duration = metadata.format.duration || 0;
                    const timestamp = Math.max(0.1 * duration, 1);

                    ffmpeg(videoFile)
                        .screenshots({
                            timestamps: [timestamp],
                            filename: 'thumbnail.png',
                            folder: tempOutputDir,
                            size: `${params.max_hw}x?`
                        })
                        .on('end', () => {
                            log.info(`Video frame extraction complete for ${objectId}`);
                            resolve();
                        })
                        .on('error', (err) => {
                            log.error(`Error extracting frame from video: ${err.message}`);
                            reject(err);
                        });
                });
            });

            if (fs.existsSync(thumbnailPath)) {
                renditionPages.push(thumbnailPath);
            } else {
                throw new Error(`Failed to generate thumbnail for video ${objectId}`);
            }
        } catch (error) {
            log.error(`Error generating image rendition for video: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw new Error(`Failed to generate image rendition for video: ${objectId}`);
        }
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
        let resizedImagePath = null;

        try {
            // Resize the image using ImageMagick
            resizedImagePath = await imageResizer(page, params.max_hw, params.format);

            // Create a read stream from the resized image file
            const fileStream = fs.createReadStream(resizedImagePath);

            const source = new NodeStreamSource(
                fileStream,
                pageId.replace('renditions/', '').replace('/', '_'),
                'image/' + params.format,
                pageId,
            );

            log.info(`Uploading rendition for ${objectId} page ${i} with max_hw: ${params.max_hw} and format: ${params.format}`);

            const result = await client.objects.upload(source).catch((err) => {
                log.error(`Failed to upload rendition for ${objectId} page ${i}`, err);
                return Promise.resolve(null);
            });

            // Clean up the temporary file after upload
            if (resizedImagePath && fs.existsSync(resizedImagePath)) {
                try {
                    fs.unlinkSync(resizedImagePath);
                    log.info(`Cleaned up temporary file: ${resizedImagePath}`);
                } catch (cleanupError) {
                    log.warn(`Failed to clean up temporary file: ${resizedImagePath}`, { error: cleanupError });
                }
            }

            return result;
        } catch (error) {
            log.error(`Failed to process rendition for ${objectId} page ${i}`, { error });

            // Clean up the temporary file if there was an error
            if (resizedImagePath && fs.existsSync(resizedImagePath)) {
                try {
                    fs.unlinkSync(resizedImagePath);
                    log.info(`Cleaned up temporary file: ${resizedImagePath}`);
                } catch (cleanupError) {
                    log.warn(`Failed to clean up temporary file: ${resizedImagePath}`, { error: cleanupError });
                }
            }

            return Promise.resolve(null);
        }
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
            width: params.max_hw
        } satisfies RenditionProperties
    });

    log.info(`Rendition ${rendition.id} created for ${objectId}`, { rendition });

    return { id: rendition.id, format: params.format, status: "success" };

}
