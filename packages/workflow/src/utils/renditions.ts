import fs from 'node:fs';
import { log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import { NodeStreamSource } from '@vertesia/client/node';
import { getRenditionPagePath, getRenditionsPath, type ImageRenditionFormat } from '@vertesia/common';
import pLimit from 'p-limit';
import { imageResizer } from '../conversion/image.js';

export interface ImageRenditionParams {
    max_hw: number; //maximum size of the longest side of the image
    format: ImageRenditionFormat;
    /** Custom upload path — overrides default renditions/{etag}/{max_hw}/{page}.{format} path */
    outputPath?: string;
}

/**
 * Get the path for all files for a rendition
 * @param objectId
 * @param params
 * @param pageNumber
 * @returns
 */
export { getRenditionPagePath, getRenditionsPath };

/**
 * Get a specific page path for a rendition
 */
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
    log.debug(
        `Uploading rendition for etag ${contentEtag} with ${files.length} pages (max_hw: ${params.max_hw}, format: ${params.format})`,
        { files },
    );

    const limit = pLimit(concurrency ?? 20);

    const uploads = files.map((file, i) =>
        limit(async () => {
            const pageId = params.outputPath
                ? files.length === 1
                    ? params.outputPath
                    : `${params.outputPath}/${String(i).padStart(4, '0')}.${params.format}`
                : getRenditionPagePath(contentEtag, params, i);
            let resizedImagePath: string | undefined;

            try {
                log.debug(`Resizing image for ${contentEtag} page ${i}`, {
                    file,
                    params,
                });
                // Resize the image using ImageMagick
                resizedImagePath = await imageResizer(file, params.max_hw, params.format);

                // Create a read stream from the resized image file
                const fileStream = fs.createReadStream(resizedImagePath);
                const format = `image/${params.format}`;
                const fileId = pageId.split('/').pop() ?? pageId;
                const source = new NodeStreamSource(fileStream, fileId, format, pageId);

                log.debug(
                    `Uploading rendition for ${contentEtag} page ${i} with max_hw: ${params.max_hw} and format: ${params.format}`,
                    {
                        resizedImagePath,
                        fileId,
                        format,
                        pageId,
                    },
                );

                const result = await client.files.uploadFile(source);
                log.debug(`Rendition uploaded for ${contentEtag} page ${i}`, {
                    result,
                });

                return result;
            } catch (err: unknown) {
                log.error(`Failed to upload rendition for ${contentEtag} page ${i}`, {
                    error: err,
                });
                throw err;
            } finally {
                if (resizedImagePath) {
                    try {
                        fs.unlinkSync(resizedImagePath);
                    } catch (err) {
                        log.warn(`Failed to clean resized rendition file for ${contentEtag} page ${i}`, { err });
                    }
                }
            }
        }),
    );

    return Promise.all(uploads);
}
