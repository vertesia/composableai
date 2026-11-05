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
    isVideoContentType,
    POSTER_RENDITION_NAME,
    type RenditionWithDimensions,
    type VideoMetadata,
    WEB_VIDEO_RENDITION_NAME,
} from '@vertesia/common';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { assertBlobSizeWithin, removeTempFiles, saveBlobToTempFile } from '../../utils/blobs.js';
import { getSourceLimits } from '../../utils/source-limits.js';
import { closeUploadStream, createUploadStream } from '../../utils/upload-stream.js';
import {
    execActivityFile,
    execActivityFileWithProgress,
    ffmpegInputThreadArgs,
    ffmpegOutputThreadArgs,
    libx264ThreadArgs,
    rethrowIfActivityStopped,
    UNUSABLE_VIDEO_CONTENT,
} from './exec.js';
import {
    allSettledOrThrow,
    buildFrameGrabArgs,
    buildProbeArgs,
    commandFailureLog,
    execOnVideoInput,
    ffmpegInputArgs,
    parseDuration,
    rethrowIfStoppedReading,
    type VideoInput,
    VideoSource,
} from './videoSource.js';

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

/** A one-second minimum seek would miss the only frame of a short, low-frame-rate clip. */
export function screenshotTimestamp(duration: number, ratio: number, maxTimestamp = Number.POSITIVE_INFINITY): number {
    if (duration <= MIN_SCREENSHOT_TIMESTAMP) return 0;
    return Math.min(Math.max(Math.min(duration * ratio, maxTimestamp), MIN_SCREENSHOT_TIMESTAMP), duration / 2);
}

// FFmpeg configuration constants
const VIDEO_CRF = '23'; // Constant Rate Factor for video quality (18-28, lower = better)
const AUDIO_BITRATE = '128k'; // Audio bitrate for AAC encoding

export const VIDEO_PRESETS = ['medium', 'fast', 'veryfast', 'ultrafast'] as const;
export type VideoPreset = (typeof VIDEO_PRESETS)[number];
const DEFAULT_VIDEO_PRESET: VideoPreset = 'veryfast';

/**
 * Returns the requested preset, or the default when none is set. Retries keep the same preset, except a transcode
 * retried after running into its deadline (see {@link presetAfterDeadline}).
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

/** The fastest preset; a transcode too slow at it gets no faster preset to retry with. */
export const FASTEST_VIDEO_PRESET: VideoPreset = VIDEO_PRESETS[VIDEO_PRESETS.length - 1];

/**
 * The preset for a transcode attempt: `preset`, or, when an earlier attempt ran into its deadline at `deadlinePreset`,
 * one step faster than that, up to {@link FASTEST_VIDEO_PRESET}. An attempt that failed for any other reason (a lost
 * worker, a failed download) does not change the preset.
 */
export function presetAfterDeadline(preset: VideoPreset, deadlinePreset?: VideoPreset): VideoPreset {
    if (deadlinePreset === undefined) {
        return preset;
    }
    const index = Math.max(VIDEO_PRESETS.indexOf(preset), VIDEO_PRESETS.indexOf(deadlinePreset) + 1);
    return VIDEO_PRESETS[Math.min(index, VIDEO_PRESETS.length - 1)];
}

export interface VideoMetadataExtended {
    duration: number;
    width: number;
    height: number;
    codec: string;
    bitrate: number;
    fps: number;
    hasAudio: boolean;
    /** Container names as ffprobe reports them, e.g. `mov,mp4,m4a,3gp,3g2,mj2`. */
    formatName: string;
    /** Number of audio streams in the source. */
    audioStreams: number;
    /** Codec, channel count and duration (seconds) of the first audio stream. */
    audioCodec?: string;
    audioChannels?: number;
    audioDuration?: number;
}

interface FFProbeStream {
    codec_type: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    channels?: number;
    duration?: string;
    /** Matroska and WebM keep the stream duration here, as `HH:MM:SS.nnnnnnnnn`, instead of in `duration`. */
    tags?: { DURATION?: string };
}

interface FFProbeFormat {
    duration?: string;
    bit_rate?: string;
    format_name?: string;
}

interface FFProbeOutput {
    streams: FFProbeStream[];
    format: FFProbeFormat;
}

/**
 * The video's duration in seconds, or 0 when the file gives none. The container duration is the file's playback length,
 * which players report, so it comes first. When the container omits it, use the video stream's duration.
 */
export function resolvePlaybackDuration(format: FFProbeFormat, videoStream: FFProbeStream): number {
    return (
        parseDuration(format.duration) ??
        parseDuration(videoStream.duration) ??
        parseDuration(videoStream.tags?.DURATION) ??
        0
    );
}

/**
 * Extract comprehensive video metadata using ffprobe
 */
export async function getVideoMetadata(input: VideoInput): Promise<VideoMetadataExtended> {
    try {
        const { stdout } = await execOnVideoInput(input, 'ffprobe', buildProbeArgs(input));
        const metadata = JSON.parse(stdout) as FFProbeOutput;

        const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');

        if (!videoStream) {
            throw ApplicationFailure.nonRetryable('No video stream found in file', UNUSABLE_VIDEO_CONTENT);
        }

        // 0 when the file states no duration, as browser-recorded WebM often does. Such files are still processed.
        const duration = resolvePlaybackDuration(metadata.format, videoStream);
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
        const audioStreams = metadata.streams.filter((stream) => stream.codec_type === 'audio');
        const audioStream = audioStreams[0];

        return {
            duration,
            width,
            height,
            codec,
            bitrate,
            fps,
            hasAudio: !!audioStream,
            formatName: metadata.format.format_name || 'unknown',
            audioStreams: audioStreams.length,
            audioCodec: audioStream?.codec_name,
            audioChannels: audioStream?.channels,
            audioDuration: parseDuration(audioStream?.duration) ?? parseDuration(audioStream?.tags?.DURATION),
        };
    } catch (error) {
        rethrowIfActivityStopped(error);
        const message = `Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (error instanceof ApplicationFailure) {
            // Raised above: the file has no usable video stream, a property of the content.
            log.warn(message);
            throw error;
        }
        commandFailureLog(input)(message);
        throw new Error(`Failed to probe video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Probe the video over its signed URL, falling back to the download. Over HTTP a probe can miss a duration that a local
 * read finds (a server without range support, or an index at the end), so a URL probe without one is retried locally.
 * A local probe without a duration is accepted: the file has none.
 */
export async function probeVideoSource(source: VideoSource): Promise<VideoMetadataExtended> {
    const metadata = await source.withFallback(async (input) => {
        const probed = await getVideoMetadata(input);
        return input.kind === 'url' && probed.duration <= 0 ? undefined : probed;
    });
    if (!metadata) {
        // Not reached: the local attempt always returns its metadata.
        throw new Error('Video probe returned no metadata');
    }
    return metadata;
}

/**
 * Calculate scaled dimensions maintaining aspect ratio
 * Scales based on longest side, ensuring dimensions are even (required for H.264)
 */
export function calculateScaledDimensions(
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
    timeBudgetMs?: number,
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
        // With a time budget, a transcode that is not going to finish in time is stopped early instead of running into
        // its Activity timeout, which Temporal would retry.
        const { stderr } = await execActivityFileWithProgress(
            'ffmpeg',
            command,
            timeBudgetMs && metadata.duration > 0
                ? { completionBudget: { mediaDurationSeconds: metadata.duration, budgetMs: timeBudgetMs } }
                : {},
        );
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
 * Whether the audio rendition can copy the source's audio track instead of encoding it: a single AAC track with at most
 * two channels, which is what the encode would produce anyway.
 */
export function isAudioCopyEligible(metadata: VideoMetadataExtended): boolean {
    const channels = metadata.audioChannels ?? 0;
    return metadata.audioStreams === 1 && metadata.audioCodec === 'aac' && channels >= 1 && channels <= 2;
}

/**
 * Copy the audio track without decoding it. `-xerror` makes a broken input fail the command: without it, ffmpeg ends a
 * stream cut short with a truncated file and exit code 0.
 */
export function buildAudioCopyArgs(input: VideoInput, outputFile: string): string[] {
    return ['-y', '-xerror', ...ffmpegInputArgs(input), '-vn', '-c:a', 'copy', outputFile];
}

/** Tolerance for {@link isAudioDurationComplete}: the larger of one second and 1% of the expected duration. */
export function isAudioDurationComplete(actual: number, expected: number): boolean {
    return actual >= expected - Math.max(1, expected * 0.01);
}

/** Container duration in seconds of a local file, or undefined when ffprobe reports none. */
async function probeDuration(file: string): Promise<number | undefined> {
    const { stdout } = await execActivityFile('ffprobe', [
        '-v',
        'quiet',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        file,
    ]);
    return parseDuration(stdout.trim());
}

/**
 * Fast path for the audio rendition: copy the source's AAC track.
 * Returns the file, or undefined when the copy fails or writes no audio. `-xerror` fails a read that is cut short, so
 * a copy that ends before `expected` seconds comes from a source holding less audio than it states, such as a truncated
 * upload. Encoding reads the same packets and comes out no longer, so the copy is kept.
 */
async function copyAudioRendition(
    input: VideoInput,
    outputDir: string,
    expected: number | undefined,
): Promise<string | undefined> {
    const outputFile = path.join(outputDir, 'audio.m4a');
    try {
        await execOnVideoInput(input, 'ffmpeg', buildAudioCopyArgs(input, outputFile), {
            progress: true,
            logMessage: 'Copying audio track for audio-only rendition',
        });
        const actual = await probeDuration(outputFile);
        if (actual === undefined) {
            log.warn('Copied audio track has no duration; encoding it from a download instead');
            return undefined;
        }
        if (expected !== undefined && !isAudioDurationComplete(actual, expected)) {
            log.warn('Copied audio track is shorter than the source states; the source holds no more audio', {
                actual,
                expected,
            });
        }
        return outputFile;
    } catch (error) {
        rethrowIfStoppedReading(error, input);
        log.warn('Failed to copy audio track; encoding it from a download instead', {
            error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}

export type AudioRenditionMode = 'copy' | 'encode';

/**
 * Copy an eligible source audio track, over the URL unless the source is already downloaded. Fall back to encoding the
 * downloaded source when the track is not eligible or the copy fails.
 */
export async function extractAudioRendition(
    source: VideoSource,
    outputDir: string,
    metadata: VideoMetadataExtended,
): Promise<{ file: string; mode: AudioRenditionMode } | null> {
    if (isAudioCopyEligible(metadata)) {
        // A copy needs a single track, so the probed track is the one copied. The container duration is no reference:
        // an audio track may end before the video.
        const copied = await copyAudioRendition(await source.partialInput(), outputDir, metadata.audioDuration);
        if (copied) {
            return { file: copied, mode: 'copy' };
        }
    }
    const encoded = await generateAudioRendition(await source.localPath(), outputDir);
    return encoded ? { file: encoded, mode: 'encode' } : null;
}

/**
 * Extract a screenshot frame from the video at a specific timestamp
 */
export function buildScreenshotArgs(
    input: VideoInput,
    outputFile: string,
    timestamp: number,
    dimensions: { width: number; height: number },
): string[] {
    return buildFrameGrabArgs(input, outputFile, timestamp, `scale=${dimensions.width}:${dimensions.height}`);
}

export async function generateScreenshot(
    input: VideoInput,
    outputDir: string,
    timestamp: number,
    maxSize: number,
    name: string,
    metadata: VideoMetadataExtended,
): Promise<MediaResult | undefined> {
    const outputFile = path.join(outputDir, `${name}.jpg`);

    // Calculate scaled dimensions
    const dimensions = calculateScaledDimensions(metadata.width, metadata.height, maxSize);

    try {
        const { stderr } = await execOnVideoInput(
            input,
            'ffmpeg',
            buildScreenshotArgs(input, outputFile, timestamp, dimensions),
            { logMessage: `Generating ${name} at ${timestamp}s` },
        );

        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for ${name}: ${stderr}`);
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
            if (timestamp > 0) {
                log.debug(`${name} seek produced no frame; retrying at frame zero`);
                return await generateScreenshot(input, outputDir, 0, maxSize, name, metadata);
            }
            log.warn(`${name} not generated`);
            return undefined;
        }
    } catch (error) {
        rethrowIfActivityStopped(error);
        // This optional rendition falls back to the source video; upload/update failures below
        // still fail the activity and are reported as errors.
        log.warn(`Failed to generate ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return undefined;
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
    const fileStream = createUploadStream(filePath);
    const source = new NodeStreamSource(fileStream, fileName, mimeType, storagePath);

    try {
        const result = await client.files.uploadFile(source);
        log.debug(`Uploaded file to ${storagePath}`, { result });
        return result;
    } finally {
        await closeUploadStream(fileStream);
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

    if (!isVideoContentType(inputObject.content.type)) {
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
    // A source over the media limit fails with a non-retryable SourceTooLargeError, before any download when the
    // store reports its size.
    const videoFile = await saveBlobToTempFile(client, source, undefined, {
        maxBytes: getSourceLimits().mediaMaxBytes,
        limit: 'media',
    });
    // Created inside the try, so a failure here still removes the download in the finally.
    let tempOutputDir: string | undefined;

    try {
        tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), outputDirPrefix));
        return await work(videoFile, tempOutputDir);
    } finally {
        await removeTempFiles(videoFile, tempOutputDir);
    }
}

/**
 * Open the video for reading over a signed URL, create a temp output directory, run `work`, then remove the directory
 * and any download the work made. Probes and frame grabs read the URL; a step that needs the whole file downloads it
 * once with {@link VideoSource.localPath}.
 */
export async function withVideoSource<T>(
    client: VertesiaClient,
    sourceUri: string,
    outputDirPrefix: string,
    work: (source: VideoSource, outputDir: string) => Promise<T>,
): Promise<T> {
    // A source over the media limit fails with a non-retryable SourceTooLargeError before any read, when the store
    // reports its size; a download of a source of unknown size stops at the limit.
    await assertBlobSizeWithin(client, sourceUri, getSourceLimits().mediaMaxBytes, 'media');
    const source = await VideoSource.open(client, sourceUri);
    let tempOutputDir: string | undefined;

    try {
        tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), outputDirPrefix));
        return await work(source, tempOutputDir);
    } finally {
        await Promise.all([source.dispose(), removeTempFiles(tempOutputDir)]);
    }
}

export interface VideoFrames {
    thumbnail: MediaResult | undefined;
    poster: MediaResult | undefined;
}

/**
 * Extract the thumbnail and poster frames in parallel, each over the source's URL with a download fallback.
 */
export async function extractVideoFrames(
    source: VideoSource,
    outputDir: string,
    metadata: VideoMetadataExtended,
    thumbnailSize: number,
    posterSize: number,
): Promise<VideoFrames> {
    const thumbnailTimestamp = screenshotTimestamp(metadata.duration, THUMBNAIL_TIMESTAMP_RATIO);
    const posterTimestamp = screenshotTimestamp(metadata.duration, POSTER_TIMESTAMP_RATIO, POSTER_TIMESTAMP_MAX);

    const [thumbnail, poster] = await allSettledOrThrow([
        source.withFallback((input) =>
            generateScreenshot(input, outputDir, thumbnailTimestamp, thumbnailSize, 'thumbnail', metadata),
        ),
        source.withFallback((input) =>
            generateScreenshot(input, outputDir, posterTimestamp, posterSize, 'poster', metadata),
        ),
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
