import type { ReadStream } from 'node:fs';
import { Context, log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import { NodeStreamSource } from '@vertesia/client/node';
import { getRenditionPagePath, getRenditionsPath, type ImageRenditionFormat } from '@vertesia/common';
import pLimit from 'p-limit';
import { imageResizer } from '../conversion/image.js';
import { removeTempFiles } from './blobs.js';
import { closeUploadStream, createUploadStream } from './upload-stream.js';

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
            let fileStream: ReadStream | undefined;

            try {
                log.debug(`Resizing image for ${contentEtag} page ${i}`, {
                    file,
                    params,
                });
                // Resize the image using ImageMagick
                resizedImagePath = await imageResizer(file, params.max_hw, params.format);

                fileStream = createUploadStream(resizedImagePath);
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
                if (isActivityStopping()) {
                    // A worker shutdown or cancellation aborts the upload; Temporal retries the activity.
                    log.info(`Rendition upload for ${contentEtag} page ${i} interrupted: the activity is stopping`, {
                        error: err,
                    });
                } else {
                    log.error(`Failed to upload rendition for ${contentEtag} page ${i}`, {
                        error: err,
                    });
                }
                throw err;
            } finally {
                await closeUploadStream(fileStream);
                await removeTempFiles(resizedImagePath);
            }
        }),
    );

    return Promise.all(uploads);
}

/** Whether the current activity was cancelled or its worker is shutting down. False outside an activity. */
function isActivityStopping(): boolean {
    try {
        return Context.current().cancellationSignal.aborted;
    } catch {
        return false;
    }
}
