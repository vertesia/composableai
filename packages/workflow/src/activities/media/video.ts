import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApplicationFailure, log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type { VertesiaClient } from '@vertesia/client';
import {
    AUDIO_RENDITION_NAME,
    ContentNature,
    type ContentObject,
    POSTER_RENDITION_NAME,
    type RenditionWithDimensions,
    type VideoMetadata,
    WEB_VIDEO_RENDITION_NAME,
} from '@vertesia/common';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import {
    execActivityFile,
    execActivityFileWithProgress,
    ffmpegInputThreadArgs,
    ffmpegOutputThreadArgs,
    libx264ThreadArgs,
    rethrowIfActivityStopped,
    UNUSABLE_VIDEO_CONTENT,
} from './exec.js';

// Shared steps of the video activities: prepareVideo runs them all in one Activity, while extractVideoAssets,
// transcodeVideo and addObjectRendition run them as separate Activities so the long transcode can be scheduled apart
// from the quick frame and audio extraction.

// Default configuration constants
export const DEFAULT_MAX_RESOLUTION = 1920; // Max resolution for video rendition (produces 1080p)
export const DEFAULT_THUMBNAIL_SIZE = 256; // Thumbnail longest side in pixels
export const DEFAULT_POSTER_SIZE = 1920; // Poster longest side in pixels
export const DEFAULT_GENERATE_AUDIO = true; // Generate audio-only rendition by default

// Timestamp calculation constants for screenshots
const THUMBNAIL_TIMESTAMP_RATIO = 0.25; // Extract thumbnail at 25% of video duration
const POSTER_TIMESTAMP_RATIO = 0.05; // Extract poster at 5% of video duration
const POSTER_TIMESTAMP_MAX = 2; // Maximum poster timestamp in seconds
const MIN_SCREENSHOT_TIMESTAMP = 1; // Minimum timestamp for screenshots in seconds

// FFmpeg configuration constants
const VIDEO_CRF = '23'; // Constant Rate Factor for video quality (18-28, lower = better)
const AUDIO_BITRATE = '128k'; // Audio bitrate for AAC encoding
const JPEG_QUALITY = '2'; // JPEG quality for screenshots (1-31, lower = better)

export const VIDEO_PRESETS = ['medium', 'fast', 'veryfast', 'ultrafast'] as const;
export type VideoPreset = (typeof VIDEO_PRESETS)[number];
const DEFAULT_VIDEO_PRESET: VideoPreset = 'veryfast';

/**
 * Returns the requested preset, or the default when none is set. Retries keep the same preset.
 * Workflow definitions can pass any string, so an unknown preset fails the activity without retrying.
 */
export function resolveVideoPreset(preset?: string): VideoPreset {
    if (preset === undefined) {
        return DEFAULT_VIDEO_PRESET;
    }
    if (!(VIDEO_PRESETS as readonly string[]).includes(preset)) {
        throw ApplicationFailure.nonRetryable(
            `Invalid videoPreset "${preset}"; expected one of: ${VIDEO_PRESETS.join(', ')}`,
            'InvalidVideoPreset',
        );
    }
    return preset as VideoPreset;
}

export interface VideoMetadataExtended {
    duration: number;
    width: number;
    height: number;
    codec: string;
    bitrate: number;
    fps: number;
    hasAudio: boolean;
}

interface FFProbeStream {
    codec_type: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
}

interface FFProbeFormat {
    duration?: string;
    bit_rate?: string;
}

interface FFProbeOutput {
    streams: FFProbeStream[];
    format: FFProbeFormat;
}

/**
 * Extract comprehensive video metadata using ffprobe
 */
export async function getVideoMetadata(videoPath: string): Promise<VideoMetadataExtended> {
    try {
        const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', videoPath];
        const { stdout } = await execActivityFile('ffprobe', args);
        const metadata = JSON.parse(stdout.toString()) as FFProbeOutput;

        const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');

        if (!videoStream) {
            throw ApplicationFailure.nonRetryable('No video stream found in file', UNUSABLE_VIDEO_CONTENT);
        }

        const duration = parseFloat(metadata.format.duration ?? '0') || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const codec = videoStream.codec_name || 'unknown';
        const bitrate = parseInt(metadata.format.bit_rate ?? '0', 10) || 0;

        // Calculate FPS from r_frame_rate (e.g., "30/1" or "24000/1001")
        let fps = 0;
        if (videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            fps = den > 0 ? num / den : 0;
        }

        // Check if video has an audio stream
        const audioStream = metadata.streams.find((stream) => stream.codec_type === 'audio');
        const hasAudio = !!audioStream;

        return { duration, width, height, codec, bitrate, fps, hasAudio };
    } catch (error) {
        rethrowIfActivityStopped(error);
        const message = `Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (error instanceof ApplicationFailure) {
            // Raised above: the file has no usable video stream, a property of the content.
            log.warn(message);
            throw error;
        }
        log.error(message);
        throw new Error(`Failed to probe video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Calculate scaled dimensions maintaining aspect ratio
 * Scales based on longest side, ensuring dimensions are even (required for H.264)
 */
function calculateScaledDimensions(
    width: number,
    height: number,
    maxResolution: number,
): { width: number; height: number } {
    const longestSide = Math.max(width, height);
    let newWidth: number;
    let newHeight: number;

    if (longestSide > maxResolution) {
        // Scale down if video is larger than max resolution
        const scale = maxResolution / longestSide;
        newWidth = Math.floor(width * scale);
        newHeight = Math.floor(height * scale);
    } else {
        // Keep original dimensions if video is smaller
        newWidth = width;
        newHeight = height;
    }

    // Ensure dimensions are divisible by 2 (required for H.264/image processing)
    const adjustedWidth = newWidth % 2 === 0 ? newWidth : newWidth - 1;
    const adjustedHeight = newHeight % 2 === 0 ? newHeight : newHeight - 1;

    return { width: adjustedWidth, height: adjustedHeight };
}

export interface MediaResult {
    file: string;
    width: number;
    height: number;
}

/**
 * ffmpeg arguments for the web (H.264) rendition, with every thread pool sized to the CPUs the worker may use.
 */
export function buildWebRenditionArgs(
    videoPath: string,
    outputFile: string,
    dimensions: { width: number; height: number },
    videoPreset: VideoPreset,
): string[] {
    // Combine scale with color space conversion for maximum web compatibility
    // format=yuv420p converts to 4:2:0 chroma subsampling (from ProRes 4:2:2 or higher)
    const videoFilters = `scale=${dimensions.width}:${dimensions.height},format=yuv420p`;

    return [
        '-y', // Overwrite output
        ...ffmpegInputThreadArgs(),
        '-i',
        videoPath,
        '-vf',
        videoFilters,
        '-c:v',
        'libx264', // H.264 codec
        ...libx264ThreadArgs(),
        '-preset',
        videoPreset,
        '-crf',
        VIDEO_CRF, // Constant Rate Factor (18-28, lower = better quality)
        '-pix_fmt',
        'yuv420p', // Explicitly set pixel format for compatibility
        '-c:a',
        'aac', // Audio codec
        '-b:a',
        AUDIO_BITRATE, // Audio bitrate
        '-movflags',
        '+faststart', // Enable streaming
        '-max_muxing_queue_size',
        '1024', // Prevent muxing issues
        outputFile,
    ];
}

/**
 * Generate a video rendition with resolution limited to maxResolution (e.g., 1080p)
 * Uses H.264 codec for broad compatibility
 */
export async function generateRenditionWithDimensions(
    videoPath: string,
    outputDir: string,
    metadata: VideoMetadataExtended,
    maxResolution: number,
    videoPreset: VideoPreset,
): Promise<MediaResult | null> {
    const outputFile = path.join(outputDir, `rendition_${maxResolution}p.mp4`);

    // Calculate scaled dimensions
    const dimensions = calculateScaledDimensions(metadata.width, metadata.height, maxResolution);

    log.debug(
        `Video rendition dimensions: ${metadata.width}x${metadata.height} -> ${dimensions.width}x${dimensions.height}`,
    );

    const command = buildWebRenditionArgs(videoPath, outputFile, dimensions, videoPreset);

    log.debug(`Generating ${maxResolution}p video rendition`, { command: 'ffmpeg', args: command });

    try {
        const { stderr } = await execActivityFileWithProgress('ffmpeg', command);
        const stderrText = stderr.toString();

        if (stderrText && !stderrText.includes('frame=')) {
            log.debug(`FFmpeg stderr for video rendition: ${stderrText}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.debug(`Generated ${maxResolution}p video rendition: ${outputFile}`);
            return {
                file: outputFile,
                width: dimensions.width,
                height: dimensions.height,
            };
        } catch {
            log.warn(`Video rendition not generated`);
            return null;
        }
    } catch (error) {
        rethrowIfActivityStopped(error);
        log.error(`Failed to generate video rendition: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

/**
 * Extract audio track from video as AAC audio file
 */
export async function generateAudioRendition(videoPath: string, outputDir: string): Promise<string | null> {
    const outputFile = path.join(outputDir, 'audio.m4a');

    const command = [
        '-y', // Overwrite output
        ...ffmpegInputThreadArgs(),
        '-i',
        videoPath,
        '-vn', // No video
        '-c:a',
        'aac', // Audio codec
        '-b:a',
        AUDIO_BITRATE, // Audio bitrate
        ...ffmpegOutputThreadArgs(),
        outputFile,
    ];

    log.debug('Generating audio-only rendition', { command: 'ffmpeg', args: command });

    try {
        const { stderr } = await execActivityFileWithProgress('ffmpeg', command);
        const stderrText = stderr.toString();

        if (stderrText && !stderrText.includes('frame=')) {
            log.debug(`FFmpeg stderr for audio rendition: ${stderrText}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.debug(`Generated audio rendition: ${outputFile}`);
            return outputFile;
        } catch {
            log.warn('Audio rendition not generated');
            return null;
        }
    } catch (error) {
        rethrowIfActivityStopped(error);
        log.error(`Failed to generate audio rendition: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

/**
 * Extract a screenshot frame from the video at a specific timestamp
 */
export async function generateScreenshot(
    videoPath: string,
    outputDir: string,
    timestamp: number,
    maxSize: number,
    name: string,
    metadata: VideoMetadataExtended,
): Promise<MediaResult | null> {
    const outputFile = path.join(outputDir, `${name}.jpg`);

    // Calculate scaled dimensions
    const dimensions = calculateScaledDimensions(metadata.width, metadata.height, maxSize);

    const scaleFilter = `scale=${dimensions.width}:${dimensions.height}`;

    const command = [
        '-y',
        ...ffmpegInputThreadArgs(),
        '-ss',
        timestamp.toString(),
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-vf',
        scaleFilter,
        '-q:v',
        JPEG_QUALITY, // High quality JPEG
        ...ffmpegOutputThreadArgs(),
        outputFile,
    ];

    log.debug(`Generating ${name} at ${timestamp}s`, { command: 'ffmpeg', args: command });

    try {
        const { stderr } = await execActivityFile('ffmpeg', command);
        const stderrText = stderr.toString();

        if (stderrText && !stderrText.includes('frame=')) {
            log.debug(`FFmpeg stderr for ${name}: ${stderrText}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.debug(`Generated ${name}: ${outputFile}`);
            return {
                file: outputFile,
                width: dimensions.width,
                height: dimensions.height,
            };
        } catch {
            log.warn(`${name} not generated`);
            return null;
        }
    } catch (error) {
        rethrowIfActivityStopped(error);
        log.error(`Failed to generate ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

/**
 * Upload a file to the storage and return its URI
 */
export async function uploadFile(
    client: VertesiaClient,
    filePath: string,
    mimeType: string,
    fileName: string,
    storagePath: string,
): Promise<string> {
    const { NodeStreamSource } = await import('@vertesia/client/node');
    const fileStream = fs.createReadStream(filePath);
    const source = new NodeStreamSource(fileStream, fileName, mimeType, storagePath);

    try {
        const result = await client.files.uploadFile(source);
        log.debug(`Uploaded file to ${storagePath}`, { result });
        return result;
    } finally {
        // An upload that fails before reading the body leaves the file open.
        fileStream.destroy();
    }
}

/**
 * Upload a media result and create a rendition entry
 */
export async function uploadMediaAsRendition(
    client: VertesiaClient,
    result: MediaResult,
    renditionName: string,
    fileName: string,
    mimeType: string,
    etag: string,
    pathSegment: string,
): Promise<RenditionWithDimensions> {
    const storagePath = `renditions/${etag}/${pathSegment}/${fileName}`;
    const uri = await uploadFile(client, result.file, mimeType, fileName, storagePath);

    return {
        name: renditionName,
        dimensions: {
            width: result.width,
            height: result.height,
        },
        content: {
            source: uri,
            type: mimeType,
            name: fileName,
        },
    };
}

/**
 * Retrieve a video object and check it has a video source.
 */
export async function retrieveVideoObject(client: VertesiaClient, objectId: string): Promise<ContentObject> {
    const inputObject = await client.objects.retrieve(objectId).catch((err: unknown) => {
        log.error(`Failed to retrieve document ${objectId}`, { err });
        if (err instanceof RequestError && err.status === 404) {
            throw new DocumentNotFoundError(`Document ${objectId} not found`, [objectId]);
        }
        throw err;
    });

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new DocumentNotFoundError(`Document ${objectId} has no source`, [objectId]);
    }

    if (!inputObject.content.type?.startsWith('video/')) {
        log.error(`Document ${objectId} is not a video: ${inputObject.content.type}`);
        throw new InvalidContentTypeError(objectId, 'video/*', inputObject.content.type || 'unknown');
    }

    return inputObject;
}

/**
 * Download the video to a temp file, create a temp output directory, run `work`, then remove both.
 */
export async function withVideoWorkspace<T>(
    client: VertesiaClient,
    source: string,
    outputDirPrefix: string,
    work: (videoFile: string, outputDir: string) => Promise<T>,
): Promise<T> {
    const videoFile = await saveBlobToTempFile(client, source);
    // Created inside the try, so a failure here still removes the download in the finally.
    let tempOutputDir: string | undefined;

    try {
        tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), outputDirPrefix));
        return await work(videoFile, tempOutputDir);
    } finally {
        // Clean up temporary files
        const cleanupPromises: Promise<void>[] = [];

        if (videoFile) {
            cleanupPromises.push(
                fs.promises.unlink(videoFile).catch((err) => {
                    log.warn(`Failed to cleanup video file: ${videoFile}`, { err });
                }),
            );
        }

        if (tempOutputDir) {
            cleanupPromises.push(
                fs.promises.rm(tempOutputDir, { recursive: true, force: true }).catch((err) => {
                    log.warn(`Failed to cleanup temp directory: ${tempOutputDir}`, { err });
                }),
            );
        }

        await Promise.allSettled(cleanupPromises);
    }
}

export interface VideoFrames {
    thumbnail: MediaResult | null;
    poster: MediaResult | null;
}

/**
 * Extract the thumbnail and poster frames in parallel.
 */
export async function extractVideoFrames(
    videoFile: string,
    outputDir: string,
    metadata: VideoMetadataExtended,
    thumbnailSize: number,
    posterSize: number,
): Promise<VideoFrames> {
    const thumbnailTimestamp = Math.max(metadata.duration * THUMBNAIL_TIMESTAMP_RATIO, MIN_SCREENSHOT_TIMESTAMP);
    const posterTimestamp = Math.max(
        Math.min(metadata.duration * POSTER_TIMESTAMP_RATIO, POSTER_TIMESTAMP_MAX),
        MIN_SCREENSHOT_TIMESTAMP,
    );

    const [thumbnail, poster] = await Promise.all([
        generateScreenshot(videoFile, outputDir, thumbnailTimestamp, thumbnailSize, 'thumbnail', metadata),
        generateScreenshot(videoFile, outputDir, posterTimestamp, posterSize, 'poster', metadata),
    ]);
    return { thumbnail, poster };
}

/**
 * Upload the web rendition and return its rendition entry.
 */
export async function uploadWebRendition(
    client: VertesiaClient,
    result: MediaResult,
    maxResolution: number,
    etag: string,
): Promise<RenditionWithDimensions> {
    return await uploadMediaAsRendition(
        client,
        result,
        WEB_VIDEO_RENDITION_NAME,
        `${maxResolution}px.mp4`,
        'video/mp4',
        etag,
        'video',
    );
}

/**
 * Upload the thumbnail, poster and audio rendition, returning the poster and audio rendition entries in that order.
 * The thumbnail is stored at its conventional path and has no rendition entry.
 */
export async function uploadVideoAssets(
    client: VertesiaClient,
    frames: VideoFrames,
    audioFile: string | null,
    thumbnailSize: number,
    posterSize: number,
    etag: string,
): Promise<RenditionWithDimensions[]> {
    const renditions: RenditionWithDimensions[] = [];

    if (frames.thumbnail) {
        const fileName = 'thumbnail.jpg';
        const storagePath = `renditions/${etag}/${thumbnailSize}/${fileName}`;
        await uploadFile(client, frames.thumbnail.file, 'image/jpeg', fileName, storagePath);
    }

    if (frames.poster) {
        const posterRendition = await uploadMediaAsRendition(
            client,
            frames.poster,
            POSTER_RENDITION_NAME,
            'poster.jpg',
            'image/jpeg',
            etag,
            `${posterSize}`,
        );
        renditions.push(posterRendition);
    }

    if (audioFile) {
        const audioRendition = await uploadMediaAsRendition(
            client,
            { file: audioFile, width: 0, height: 0 },
            AUDIO_RENDITION_NAME,
            'audio.m4a',
            'audio/mp4',
            etag,
            'audio',
        );
        renditions.push(audioRendition);
    }

    return renditions;
}

/**
 * Build the stored video metadata.
 */
export function buildVideoMetadata(
    metadata: VideoMetadataExtended,
    renditions: RenditionWithDimensions[],
    currentMetadata: ContentObject['metadata'],
): VideoMetadata {
    const generationRuns = Array.isArray(currentMetadata?.generation_runs) ? currentMetadata.generation_runs : [];
    return {
        type: ContentNature.Video,
        duration: metadata.duration,
        dimensions: {
            width: metadata.width,
            height: metadata.height,
        },
        renditions,
        hasAudio: metadata.hasAudio,
        generation_runs: generationRuns,
    };
}
