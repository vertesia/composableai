import fs from 'node:fs';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import { type DSLActivityExecutionPayload, type DSLActivitySpec, isVideoContentType } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, WorkflowParamNotFoundError } from '../../errors.js';
import { type ImageRenditionParams, uploadRenditionPages } from '../../utils/renditions.js';
import {
    initializeActivityCommandDeadline,
    isUnusableVideoContent,
    rethrowIfActivityStopped,
    UNUSABLE_VIDEO_CONTENT,
} from '../media/exec.js';
import { withVideoSource } from '../media/video.js';
import {
    allSettledOrThrow,
    buildFrameGrabArgs,
    buildProbeArgs,
    commandFailureLog,
    execOnVideoInput,
    parseDuration,
    type VideoInput,
} from '../media/videoSource.js';

interface GenerateVideoRenditionParams extends ImageRenditionParams {}

interface LegacyVideoRenditionParams {
    maxHeightWidth?: number;
    format_output?: ImageRenditionParams['format'];
}

export interface GenerateVideoRendition extends DSLActivitySpec<GenerateVideoRenditionParams> {
    name: 'generateVideoRendition';
}

interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
}

/** Probe a video. `source` is a {@link VideoInput}, or the path of a local file. */
export async function getVideoMetadata(source: VideoInput | string): Promise<VideoMetadata> {
    const input: VideoInput = typeof source === 'string' ? { kind: 'file', path: source } : source;
    try {
        const { stdout } = await execOnVideoInput(input, 'ffprobe', buildProbeArgs(input));
        const metadata = JSON.parse(stdout) as {
            streams?: Array<{
                codec_type?: string;
                duration?: string;
                width?: number;
                height?: number;
                tags?: { DURATION?: string };
            }>;
            format?: { duration?: string };
        };

        const videoStream = metadata.streams?.find((stream) => stream.codec_type === 'video');
        // Matroska and WebM keep the stream duration in a DURATION tag instead of the duration field.
        const duration = resolveVideoDuration(
            videoStream?.duration ?? videoStream?.tags?.DURATION,
            metadata.format?.duration,
        );
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;

        if (!videoStream || duration <= 0) {
            throw ApplicationFailure.nonRetryable('Video has no usable stream or duration', UNUSABLE_VIDEO_CONTENT);
        }

        return { duration, width, height };
    } catch (error) {
        rethrowIfActivityStopped(error);
        const message = `Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (error instanceof ApplicationFailure) {
            // Raised above: the file has no usable video stream, a property of the content.
            log.warn(message);
            throw error;
        }
        commandFailureLog(input)(message);
        throw ApplicationFailure.nonRetryable(
            `Failed to probe video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

export function resolveVideoDuration(videoStreamDuration?: string, containerDuration?: string): number {
    // The video stream comes first so thumbnail seeks stay inside the video track.
    return parseDuration(videoStreamDuration) ?? parseDuration(containerDuration) ?? 0;
}

export function calculateThumbnailTimestamps(duration: number, thumbnailCount: number): number[] {
    const startOffset = Math.min(duration * 0.05, 5);
    const endOffset = Math.min(duration * 0.05, 5);
    const usableDuration = Math.max(duration - startOffset - endOffset, 0);

    return Array.from({ length: thumbnailCount }, (_, index) => {
        const progress = (index + 1) / (thumbnailCount + 1);
        return startOffset + usableDuration * progress;
    });
}

export async function generateThumbnailsWithFallback(
    timestamps: number[],
    generateAt: (timestamp: number) => Promise<string | undefined>,
): Promise<Array<string | undefined>> {
    const thumbnails = await allSettledOrThrow(timestamps.map(generateAt));
    if (thumbnails.some((thumbnail) => thumbnail !== undefined) || timestamps.includes(0)) {
        return thumbnails;
    }

    return [...thumbnails, await generateAt(0)];
}

export function requireGeneratedThumbnails(thumbnails: Array<string | undefined>, objectId: string): string[] {
    const generated = thumbnails.filter((thumbnail): thumbnail is string => thumbnail !== undefined);
    if (generated.length === 0) {
        throw ApplicationFailure.nonRetryable(`No thumbnails were generated for video ${objectId}`);
    }
    return generated;
}

function calculateThumbnailCount(duration: number): number {
    if (duration <= 60) return 3;
    if (duration <= 300) return 5;
    if (duration <= 600) return 8;
    if (duration <= 1800) return 12;
    if (duration <= 3600) return 16;
    return 20;
}

export function buildThumbnailArgs(
    input: VideoInput,
    outputFile: string,
    timestamp: number,
    maxSize: number,
): string[] {
    // Fit within maxSize x maxSize, keeping the aspect ratio.
    return buildFrameGrabArgs(
        input,
        outputFile,
        timestamp,
        `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`,
    );
}

async function generateThumbnail(
    input: VideoInput,
    outputDir: string,
    timestamp: number,
    maxSize: number,
): Promise<string | undefined> {
    //pad timestamp to 5 digits as filename
    const outputFile = path.join(outputDir, `thumb-${timestamp.toString().padStart(5, '0')}.jpg`);
    try {
        const { stderr } = await execOnVideoInput(
            input,
            'ffmpeg',
            buildThumbnailArgs(input, outputFile, timestamp, maxSize),
            { progress: true, logMessage: `Generating thumbnail at ${timestamp}s` },
        );

        // Log any warnings from ffmpeg
        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for thumbnail at ${timestamp}s: ${stderr}`);
        }

        // Verify the file was created
        if (fs.existsSync(outputFile)) {
            log.debug(`Generated thumbnail at ${timestamp}s`);
            return outputFile;
        } else {
            log.warn(`Thumbnail not generated for timestamp ${timestamp}s`);
            return undefined;
        }
    } catch (error) {
        rethrowIfActivityStopped(error);
        commandFailureLog(input)(
            `Failed to generate thumbnail at ${timestamp}s: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return undefined;
    }
}

export async function generateVideoRendition(payload: DSLActivityExecutionPayload<GenerateVideoRenditionParams>) {
    initializeActivityCommandDeadline();
    const { client, objectId, params: originParams } = await setupActivity<GenerateVideoRenditionParams>(payload);

    // Fix: Use maxHeightWidth if max_hw is not provided
    const legacyParams = originParams as LegacyVideoRenditionParams;
    const params = {
        ...originParams,
        max_hw: originParams.max_hw || legacyParams.maxHeightWidth || 1024, // Default to 1024 if both are missing
        format: originParams.format || legacyParams.format_output || 'png', // Default to png if format is missing
    };

    log.debug(`Generating video rendition for ${objectId}`, {
        originParams,
        params,
    });

    const inputObject = await client.objects.retrieve(objectId).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Failed to retrieve document ${objectId}`, { err });
        if (message.includes('not found')) {
            throw new DocumentNotFoundError(`Document ${objectId} not found`, [objectId]);
        }
        throw err;
    });

    if (!params.format) {
        log.error(`Format not found`);
        throw new WorkflowParamNotFoundError(`format`);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new DocumentNotFoundError(`Document ${objectId} has no source`, [objectId]);
    }

    if (!isVideoContentType(inputObject.content.type)) {
        log.error(`Document ${objectId} is not a video: ${inputObject.content.type}`);
        throw new DocumentNotFoundError(`Document ${objectId} is not a video: ${inputObject.content.type}`, [objectId]);
    }

    try {
        // Probing and single-frame seeks read a small part of the file, so read it over a signed URL and download it
        // only when that fails.
        return await withVideoSource(
            client,
            inputObject.content.source,
            'video-rendition-',
            async (source, outputDir) => {
                // Get video metadata using command line ffprobe
                const metadata = await source.withFallback(getVideoMetadata);
                const duration = metadata.duration;

                const thumbnailCount = calculateThumbnailCount(duration);

                // Generate evenly spaced timestamps, avoiding very beginning and end
                const timestamps = calculateThumbnailTimestamps(duration, thumbnailCount);

                log.info(`Generating ${thumbnailCount} thumbnails for ${duration}s video`, {
                    objectId,
                    duration,
                    thumbnailCount,
                    timestamps: timestamps.map((t) => Math.round(t)),
                    tempOutputDir: outputDir,
                });

                // Generate thumbnails using command line ffmpeg
                const thumbnails = await generateThumbnailsWithFallback(timestamps, (timestamp) =>
                    source.withFallback((input) => generateThumbnail(input, outputDir, timestamp, params.max_hw)),
                );
                const generatedThumbnails = requireGeneratedThumbnails(thumbnails, objectId);

                log.info(`Successfully generated ${generatedThumbnails.length} thumbnails for ${objectId}`, {
                    objectId,
                    generatedCount: generatedThumbnails.length,
                    requestedCount: thumbnailCount,
                });
                if (!inputObject.content?.etag) {
                    log.debug(`Document ${objectId} has no etag, using object id as etag`);
                }
                const etag = inputObject.content?.etag ?? inputObject.id;

                const uploaded = await uploadRenditionPages(client, etag, generatedThumbnails, params);

                return {
                    uploads: uploaded,
                    format: params.format,
                    thumbnailCount: generatedThumbnails.length,
                    status: 'success',
                };
            },
        );
    } catch (error) {
        rethrowIfActivityStopped(error);
        // The metadata probe already logged it at warn.
        if (isUnusableVideoContent(error)) {
            throw error;
        }
        log.error(`Error generating thumbnails for video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw new Error(`Failed to generate thumbnails for video: ${objectId}`, { cause: error });
    }
}
