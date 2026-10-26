import { log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec, RenditionWithDimensions } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { initializeActivityCommandDeadline, isUnusableVideoContent, rethrowIfActivityStopped } from './exec.js';
import {
    DEFAULT_MAX_RESOLUTION,
    generateRenditionWithDimensions,
    getVideoMetadata,
    resolveVideoPreset,
    retrieveVideoObject,
    uploadWebRendition,
    type VideoPreset,
    withVideoWorkspace,
} from './video.js';

export interface TranscodeVideoParams {
    maxResolution?: number; // Max resolution (longest side) for the web rendition, default 1920 (1080p)
    videoPreset?: VideoPreset; // FFmpeg encoding preset, default veryfast
}

export interface TranscodeVideo extends DSLActivitySpec<TranscodeVideoParams> {
    name: 'transcodeVideo';
}

export interface TranscodeVideoResult {
    objectId: string;
    /** The uploaded web rendition, or null when ffmpeg could not produce it. */
    rendition: RenditionWithDimensions | null;
    /** The content etag the rendition was made from; pass it to addObjectRendition. */
    etag?: string;
}

/**
 * Transcode a video to the H.264 web rendition and upload it.
 *
 * Writes nothing to the object: the caller stores the returned rendition with addObjectRendition once no other step is
 * writing the object's metadata.
 */
export async function transcodeVideo(
    payload: DSLActivityExecutionPayload<TranscodeVideoParams>,
): Promise<TranscodeVideoResult> {
    initializeActivityCommandDeadline();
    const { client, objectId, params } = await setupActivity<TranscodeVideoParams>(payload);

    const maxResolution = params.maxResolution ?? DEFAULT_MAX_RESOLUTION;
    const videoPreset = resolveVideoPreset(params.videoPreset);

    log.debug(`Transcoding video for ${objectId}`, { maxResolution, videoPreset });

    const inputObject = await retrieveVideoObject(client, objectId);
    const source = inputObject.content?.source as string;

    return await withVideoWorkspace(client, source, 'transcode-video-', async (videoFile, outputDir) => {
        try {
            const metadata = await getVideoMetadata(videoFile);
            const result = await generateRenditionWithDimensions(
                videoFile,
                outputDir,
                metadata,
                maxResolution,
                videoPreset,
            );

            const rendition = result
                ? await uploadWebRendition(client, result, maxResolution, inputObject.content?.etag ?? inputObject.id)
                : null;

            log.info(`Transcoded video ${objectId}`, { generated: rendition !== null, videoPreset });

            return { objectId, rendition, etag: inputObject.content?.etag };
        } catch (error) {
            rethrowIfActivityStopped(error);
            // The metadata probe already logged it at warn; keep its type and non-retryable flag.
            if (isUnusableVideoContent(error)) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error(`Error transcoding video: ${errorMessage}`, { error });
            if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
                throw error;
            }
            throw new Error(`Failed to transcode video ${objectId}: ${errorMessage}`);
        }
    });
}
