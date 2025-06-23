import { log } from "@temporalio/activity";
import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { ImageRenditionFormat } from "@vertesia/common";
import fs from "fs";
import pLimit from 'p-limit';
import { imageResizer } from "../conversion/image.js";

export interface ImageRenditionParams {
    max_hw: number; //maximum size of the longest side of the image
    format: ImageRenditionFormat;
}

/**
 * Get the path for all files for a rendition
 * @param objectId
 * @param params
 * @param pageNumber
 * @returns
 */
export function getRenditionsPath(
    contentEtag: string,
    params: ImageRenditionParams,
) {
    const path = `renditions/${contentEtag}/${params.max_hw}`;
    return path;
}

/**
 * Get a specific page path for a rendition
 */
export function getRenditionPagePath(
    contentEtag: string,
    params: ImageRenditionParams,
    pageNumber: number | string = 0,
) {
    //if number, pad to 4 char
    if (typeof pageNumber === "number") {
        pageNumber = String(pageNumber).padStart(4, "0");
    }
    const path = getRenditionsPath(contentEtag, params);
    const pagePath = `${path}/${pageNumber}.${params.format}`;
    return pagePath;
}

/**
 * Upload Rendition page to the cloud
 */
export async function uploadRenditionPages(
    client: VertesiaClient,
    contentEtag: string,
    files: string[],
    params: ImageRenditionParams,
    concurrency?: number,
) {
    log.info(
        `Uploading rendition for etag ${contentEtag} with ${files.length} pages (max_hw: ${params.max_hw}, format: ${params.format})`,
        { files },
    );

    const limit = pLimit(concurrency ?? 20);

    const uploads = files.map((file, i) => limit(async () => {
        const pageId = getRenditionPagePath(contentEtag, params, i);
        let resizedImagePath = null;

        try {
            log.info(`Resizing image for ${contentEtag} page ${i}`, {
                file,
                params,
            });
            // Resize the image using ImageMagick
            resizedImagePath = await imageResizer(
                file,
                params.max_hw,
                params.format,
            );

            // Create a read stream from the resized image file
            const fileStream = fs.createReadStream(resizedImagePath);
            const format = "image/" + params.format;
            const fileId = pageId.split("/").pop() ?? pageId;
            const source = new NodeStreamSource(
                fileStream,
                fileId,
                format,
                pageId,
            );

            log.info(
                `Uploading rendition for ${contentEtag} page ${i} with max_hw: ${params.max_hw} and format: ${params.format}`,
                {
                    resizedImagePath,
                    fileId,
                    format,
                    pageId,
                },
            );

            const result = await client.files
                .uploadFile(source)
                .catch((err) => {
                    log.error(
                        `Failed to upload rendition for ${contentEtag} page ${i}`,
                        {
                            error: err,
                            errorMessage: err.message,
                            stack: err.stack,
                        },
                    );
                    return Promise.reject(`Upload failed: ${err.message}`);
                });
            log.info(`Rendition uploaded for ${contentEtag} page ${i}`, {
                result,
            });

            return result;
        } catch (err: any) {
            log.error(`Failed to upload rendition for ${contentEtag} page ${i}`, {
                error: err,
            });
            return Promise.reject(`Upload failed: ${err.message}`);
        }
    }));

    return Promise.all(uploads);
}
