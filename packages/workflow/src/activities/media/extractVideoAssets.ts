import { log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { updateObjectMetadata } from '../../utils/metadata.js';
import { initializeActivityCommandDeadline, isUnusableVideoContent, rethrowIfActivityStopped } from './exec.js';
import { type PrepareVideoResult, toPrepareVideoMetadata } from './prepareVideo.js';
import {
    buildVideoMetadata,
    DEFAULT_GENERATE_AUDIO,
    DEFAULT_POSTER_SIZE,
    DEFAULT_THUMBNAIL_SIZE,
    extractVideoFrames,
    generateAudioRendition,
    getVideoMetadata,
    retrieveVideoObject,
    uploadVideoAssets,
    withVideoWorkspace,
} from './video.js';

export interface ExtractVideoAssetsParams {
    thumbnailSize?: number; // Max size (longest side) for thumbnail image, default 256
    posterSize?: number; // Max size (longest side) for poster image, default 1920
    generateAudio?: boolean; // Generate audio-only rendition (AAC), default true
}

export interface ExtractVideoAssets extends DSLActivitySpec<ExtractVideoAssetsParams> {
    name: 'extractVideoAssets';
}

/**
 * Probe a video, extract its poster, thumbnail and audio rendition, and store the video metadata.
 *
 * This is everything prepareVideo does except the web transcode, which transcodeVideo runs separately so it can be
 * scheduled apart from this quick work. The stored renditions are the poster and audio only: a web rendition from an
 * earlier run is dropped, and addObjectRendition adds the new one once transcodeVideo has produced it.
 */
export async function extractVideoAssets(
    payload: DSLActivityExecutionPayload<ExtractVideoAssetsParams>,
): Promise<PrepareVideoResult> {
    initializeActivityCommandDeadline();
    const { client, objectId, params } = await setupActivity<ExtractVideoAssetsParams>(payload);

    const thumbnailSize = params.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE;
    const posterSize = params.posterSize ?? DEFAULT_POSTER_SIZE;
    const generateAudio = params.generateAudio ?? DEFAULT_GENERATE_AUDIO;

    log.debug(`Extracting video assets for ${objectId}`, { thumbnailSize, posterSize, generateAudio });

    const inputObject = await retrieveVideoObject(client, objectId);
    const source = inputObject.content?.source as string;

    return await withVideoWorkspace(client, source, 'extract-video-assets-', async (videoFile, outputDir) => {
        try {
            const metadata = await getVideoMetadata(videoFile);
            const frames = await extractVideoFrames(videoFile, outputDir, metadata, thumbnailSize, posterSize);

            let audioFile: string | null = null;
            if (generateAudio && metadata.hasAudio) {
                audioFile = await generateAudioRendition(videoFile, outputDir);
            } else if (generateAudio && !metadata.hasAudio) {
                log.info('Skipping audio rendition - video has no audio track');
            }

            const etag = inputObject.content?.etag ?? inputObject.id;
            const renditions = await uploadVideoAssets(client, frames, audioFile, thumbnailSize, posterSize, etag);

            // Read generation_runs fresh rather than from the object retrieved before the extraction.
            await updateObjectMetadata(client, objectId, (current) => ({
                metadata: buildVideoMetadata(metadata, renditions, current.metadata),
            }));

            log.info(`Extracted video assets for ${objectId}`, {
                duration: metadata.duration,
                dimensions: `${metadata.width}x${metadata.height}`,
                hasAudio: metadata.hasAudio,
                renditionsGenerated: renditions.length,
            });

            return {
                objectId,
                metadata: toPrepareVideoMetadata(metadata),
                renditions,
                status: 'success',
            };
        } catch (error) {
            rethrowIfActivityStopped(error);
            // The metadata probe already logged it at warn; keep its type and non-retryable flag.
            if (isUnusableVideoContent(error)) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error(`Error extracting video assets: ${errorMessage}`, { error });
            if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
                throw error;
            }
            throw new Error(`Failed to extract video assets for ${objectId}: ${errorMessage}`);
        }
    });
}
