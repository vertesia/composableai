import { log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec, RenditionWithDimensions } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, InvalidContentTypeError, SourceTooLargeError } from '../../errors.js';
import { initializeActivityCommandDeadline, isUnusableVideoContent, rethrowIfActivityStopped } from './exec.js';
import {
    buildVideoMetadata,
    DEFAULT_GENERATE_AUDIO,
    DEFAULT_MAX_RESOLUTION,
    DEFAULT_POSTER_SIZE,
    DEFAULT_THUMBNAIL_SIZE,
    extractAudioRendition,
    extractVideoFrames,
    generateRenditionWithDimensions,
    type MediaResult,
    probeVideoSource,
    resolveVideoPreset,
    retrieveVideoObject,
    uploadVideoAssets,
    uploadWebRendition,
    type VideoMetadataExtended,
    type VideoPreset,
    withVideoSource,
} from './video.js';

export {
    buildWebRenditionArgs,
    generateScreenshot,
    resolveVideoPreset,
    screenshotTimestamp,
    VIDEO_PRESETS,
    type VideoPreset,
} from './video.js';

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

    // The probe and frames read the source over a signed URL. The transcode downloads it, and later steps reuse the copy.
    return await withVideoSource(client, source, 'prepare-video-', async (videoSource, tempOutputDir) => {
        try {
            // Step 1: Extract video metadata
            log.info('Extracting video metadata');
            const metadata = await probeVideoSource(videoSource);

            // Step 2: Generate video rendition
            let renditionResult: MediaResult | null = null;
            if (!shouldTranscodeVideo(skipTranscode)) {
                log.info('Skipping video rendition transcode by configuration');
            } else {
                log.debug('Generating video rendition');
                renditionResult = await generateRenditionWithDimensions(
                    await videoSource.localPath(),
                    tempOutputDir,
                    metadata,
                    maxResolution,
                    videoPreset,
                );
            }

            // Step 3 & 4: Generate thumbnail and poster in parallel
            log.debug('Generating thumbnail and poster');
            const frames = await extractVideoFrames(videoSource, tempOutputDir, metadata, thumbnailSize, posterSize);

            // Step 5: Generate audio rendition (if video has audio and requested). Copies an eligible source track;
            // encodes from the download otherwise.
            let audio: Awaited<ReturnType<typeof extractAudioRendition>> = null;
            if (generateAudio && metadata.hasAudio) {
                log.debug('Generating audio rendition');
                audio = await extractAudioRendition(videoSource, tempOutputDir, metadata);
            } else if (generateAudio && !metadata.hasAudio) {
                log.info('Skipping audio rendition - video has no audio track');
            }

            // Step 6: Upload generated files
            const renditions: RenditionWithDimensions[] = [];
            const etag = inputObject.content?.etag ?? inputObject.id;

            if (renditionResult) {
                renditions.push(await uploadWebRendition(client, renditionResult, maxResolution, etag));
            }
            renditions.push(
                ...(await uploadVideoAssets(client, frames, audio?.file ?? null, thumbnailSize, posterSize, etag)),
            );

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
                container: metadata.formatName,
                audioCodec: metadata.audioCodec,
                audioChannels: metadata.audioChannels,
                audioStreams: metadata.audioStreams,
                audioRendition: audio?.mode ?? 'none',
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
            // The metadata probe already logged it at warn, and a download over the media limit logged its
            // rejection; keep their type and non-retryable flag.
            if (isUnusableVideoContent(error) || error instanceof SourceTooLargeError) {
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
