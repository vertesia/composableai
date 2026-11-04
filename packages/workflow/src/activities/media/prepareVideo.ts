import { log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec, RenditionWithDimensions } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { initializeActivityCommandDeadline, isUnusableVideoContent, rethrowIfActivityStopped } from './exec.js';
import {
    buildVideoMetadata,
    DEFAULT_GENERATE_AUDIO,
    DEFAULT_MAX_RESOLUTION,
    DEFAULT_POSTER_SIZE,
    DEFAULT_THUMBNAIL_SIZE,
    extractVideoFrames,
    generateAudioRendition,
    generateRenditionWithDimensions,
    getVideoMetadata,
    type MediaResult,
    resolveVideoPreset,
    retrieveVideoObject,
    uploadVideoAssets,
    uploadWebRendition,
    type VideoMetadataExtended,
    type VideoPreset,
    withVideoWorkspace,
} from './video.js';

export { buildWebRenditionArgs, resolveVideoPreset, VIDEO_PRESETS, type VideoPreset } from './video.js';

export interface PrepareVideoParams {
    maxResolution?: number; // Max resolution (longest side) for video rendition, default 1920 (produces 1080p: 1920x1080 landscape or 1080x1920 portrait)
    thumbnailSize?: number; // Max size (longest side) for thumbnail image, default 256
    posterSize?: number; // Max size (longest side) for poster image, default 1920
    generateAudio?: boolean; // Generate audio-only rendition (AAC), default true
    videoPreset?: VideoPreset; // FFmpeg encoding preset, default veryfast
    skipTranscode?: boolean; // Skip the main video re-encode, default false
}

export function shouldTranscodeVideo(skipTranscode?: boolean): boolean {
    return skipTranscode !== true;
}

export interface PrepareVideo extends DSLActivitySpec<PrepareVideoParams> {
    name: 'prepareVideo';
}

export interface PrepareVideoMetadata {
    duration: number;
    width: number;
    height: number;
    codec: string;
    bitrate: number;
    fps: number;
    hasAudio: boolean;
}

export interface PrepareVideoResult {
    objectId: string;
    metadata: PrepareVideoMetadata;
    renditions: RenditionWithDimensions[];
    status: 'success';
}

export function toPrepareVideoMetadata(metadata: VideoMetadataExtended): PrepareVideoMetadata {
    return {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        codec: metadata.codec,
        bitrate: metadata.bitrate,
        fps: metadata.fps,
        hasAudio: metadata.hasAudio,
    };
}

/**
 * Main activity: Prepare video by extracting metadata and generating renditions
 *
 * Runs the transcode and the frame and audio extraction in one Activity. StandardVideoIntake now runs them as
 * extractVideoAssets, transcodeVideo and addObjectRendition; this stays for histories and DSL definitions that schedule it.
 */
export async function prepareVideo(
    payload: DSLActivityExecutionPayload<PrepareVideoParams>,
): Promise<PrepareVideoResult> {
    initializeActivityCommandDeadline();
    const { client, objectId, params } = await setupActivity<PrepareVideoParams>(payload);

    const maxResolution = params.maxResolution ?? DEFAULT_MAX_RESOLUTION;
    const thumbnailSize = params.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE;
    const posterSize = params.posterSize ?? DEFAULT_POSTER_SIZE;
    const generateAudio = params.generateAudio ?? DEFAULT_GENERATE_AUDIO;
    const skipTranscode = params.skipTranscode ?? false;
    const videoPreset = resolveVideoPreset(params.videoPreset);

    log.debug(`Preparing video for ${objectId}`, {
        maxResolution,
        thumbnailSize,
        posterSize,
        skipTranscode,
        videoPreset,
    });

    const inputObject = await retrieveVideoObject(client, objectId);
    const source = inputObject.content?.source as string;

    return await withVideoWorkspace(client, source, 'prepare-video-', async (videoFile, tempOutputDir) => {
        try {
            // Step 1: Extract video metadata
            log.info('Extracting video metadata');
            const metadata = await getVideoMetadata(videoFile);

            // Step 2: Generate video rendition
            let renditionResult: MediaResult | null = null;
            if (!shouldTranscodeVideo(skipTranscode)) {
                log.info('Skipping video rendition transcode by configuration');
            } else {
                log.debug('Generating video rendition');
                renditionResult = await generateRenditionWithDimensions(
                    videoFile,
                    tempOutputDir,
                    metadata,
                    maxResolution,
                    videoPreset,
                );
            }

            // Step 3 & 4: Generate thumbnail and poster in parallel
            log.debug('Generating thumbnail and poster');
            const frames = await extractVideoFrames(videoFile, tempOutputDir, metadata, thumbnailSize, posterSize);

            // Step 5: Generate audio rendition (if video has audio and requested)
            let audioFile: string | null = null;
            if (generateAudio && metadata.hasAudio) {
                log.debug('Generating audio rendition');
                audioFile = await generateAudioRendition(videoFile, tempOutputDir);
            } else if (generateAudio && !metadata.hasAudio) {
                log.info('Skipping audio rendition - video has no audio track');
            }

            // Step 6: Upload generated files
            const renditions: RenditionWithDimensions[] = [];
            const etag = inputObject.content?.etag ?? inputObject.id;

            if (renditionResult) {
                renditions.push(await uploadWebRendition(client, renditionResult, maxResolution, etag));
            }
            renditions.push(...(await uploadVideoAssets(client, frames, audioFile, thumbnailSize, posterSize, etag)));

            // Step 7: Update content object with metadata and renditions
            await client.objects.update(objectId, {
                metadata: buildVideoMetadata(metadata, renditions, inputObject.metadata),
            });

            log.info(`Successfully prepared video ${objectId}`, {
                duration: metadata.duration,
                dimensions: `${metadata.width}x${metadata.height}`,
                codec: metadata.codec,
                bitrate: metadata.bitrate,
                fps: metadata.fps,
                hasAudio: metadata.hasAudio,
                renditionsGenerated: renditions.length,
            });

            return {
                objectId,
                metadata: toPrepareVideoMetadata(metadata),
                renditions: renditions,
                status: 'success',
            };
        } catch (error) {
            rethrowIfActivityStopped(error);
            // The metadata probe already logged it at warn; keep its type and non-retryable flag.
            if (isUnusableVideoContent(error)) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error(`Error preparing video: ${errorMessage}`, { error });

            // Re-throw known errors as-is
            if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
                throw error;
            }

            // Wrap unknown errors in Error
            throw new Error(`Failed to prepare video ${objectId}: ${errorMessage}`);
        }
    });
}
