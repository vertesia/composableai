import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, WorkflowParamNotFoundError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { type ImageRenditionParams, uploadRenditionPages } from '../../utils/renditions.js';
import {
    execActivityFile,
    execActivityFileWithProgress,
    initializeActivityCommandDeadline,
    rethrowIfActivityStopped,
} from '../media/exec.js';

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

async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    try {
        const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath];
        const { stdout } = await execActivityFile('ffprobe', args);
        const metadata = JSON.parse(stdout.toString()) as {
            streams?: Array<{ codec_type?: string; duration?: string; width?: number; height?: number }>;
            format?: { duration?: string };
        };

        const videoStream = metadata.streams?.find((stream) => stream.codec_type === 'video');
        const duration = resolveVideoDuration(videoStream?.duration, metadata.format?.duration);
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;

        if (!videoStream || duration <= 0) {
            throw ApplicationFailure.nonRetryable('Video has no usable stream or duration');
        }

        return { duration, width, height };
    } catch (error) {
        rethrowIfActivityStopped(error);
        log.error(`Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw ApplicationFailure.nonRetryable(
            `Failed to probe video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

export function resolveVideoDuration(videoStreamDuration?: string, containerDuration?: string): number {
    for (const rawDuration of [videoStreamDuration, containerDuration]) {
        const duration = Number(rawDuration);
        if (Number.isFinite(duration) && duration > 0) {
            return duration;
        }
    }
    return 0;
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
    const thumbnails = await Promise.all(timestamps.map(generateAt));
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

async function generateThumbnail(
    videoPath: string,
    outputDir: string,
    timestamp: number,
    maxSize: number,
): Promise<string | undefined> {
    //pad timestamp to 5 digits as filename
    const outputFile = path.join(outputDir, `thumb-${timestamp.toString().padStart(5, '0')}.jpg`);

    // FFmpeg command to extract thumbnail at specific timestamp
    // Use proper scale filter syntax: scale=w:h:force_original_aspect_ratio=decrease
    const scaleFilter = `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`;

    const command = [
        '-y', // Overwrite output files
        '-ss',
        timestamp.toString(), // Seek to timestamp
        '-i',
        videoPath, // Input file
        '-vframes',
        '1', // Extract only 1 frame
        '-vf',
        scaleFilter, // Scale maintaining aspect ratio
        '-q:v',
        '2', // High quality
        outputFile,
    ];
    log.info(`Generating thumbnail at ${timestamp}s`, { command: 'ffmpeg', args: command });
    try {
        const { stderr } = await execActivityFileWithProgress('ffmpeg', command);
        const stderrText = stderr.toString();

        // Log any warnings from ffmpeg
        if (stderrText && !stderrText.includes('frame=')) {
            log.debug(`FFmpeg stderr for thumbnail at ${timestamp}s: ${stderrText}`);
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
        log.error(
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

    log.info(`Generating video rendition for ${objectId}`, {
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

    if (!inputObject.content.type?.startsWith('video/')) {
        log.error(`Document ${objectId} is not a video: ${inputObject.content.type}`);
        throw new DocumentNotFoundError(`Document ${objectId} is not a video: ${inputObject.content.type}`, [objectId]);
    }

    const videoFile = await saveBlobToTempFile(client, inputObject.content.source);
    let tempOutputDir: string | undefined;

    try {
        tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-rendition-'));
        const outputDir = tempOutputDir;

        // Get video metadata using command line ffprobe
        const metadata = await getVideoMetadata(videoFile);
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
        const generatedThumbnails = requireGeneratedThumbnails(
            await generateThumbnailsWithFallback(timestamps, (timestamp) =>
                generateThumbnail(videoFile, outputDir, timestamp, params.max_hw),
            ),
            objectId,
        );

        log.info(`Successfully generated ${generatedThumbnails.length} thumbnails for ${objectId}`, {
            objectId,
            generatedCount: generatedThumbnails.length,
            requestedCount: thumbnailCount,
        });
        if (!inputObject.content?.etag) {
            log.warn(`Document ${objectId} has no etag, using object id as etag`);
        }
        const etag = inputObject.content.etag ?? inputObject.id;

        const uploaded = await uploadRenditionPages(client, etag, generatedThumbnails, params);

        return {
            uploads: uploaded,
            format: params.format,
            thumbnailCount: generatedThumbnails.length,
            status: 'success',
        };
    } catch (error) {
        rethrowIfActivityStopped(error);
        log.error(`Error generating thumbnails for video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof ApplicationFailure) {
            throw error;
        }
        throw new Error(`Failed to generate thumbnails for video: ${objectId}`, { cause: error });
    } finally {
        for (const temporaryPath of [videoFile, tempOutputDir]) {
            if (!temporaryPath) {
                continue;
            }
            try {
                fs.rmSync(temporaryPath, { force: true, recursive: true });
            } catch (error) {
                log.warn(`Failed to clean up temporary video rendition path`, { error, temporaryPath });
            }
        }
    }
}
