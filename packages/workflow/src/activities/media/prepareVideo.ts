import { log } from '@temporalio/activity';
import { DSLActivityExecutionPayload, DSLActivitySpec, VideoMetadata, VideoRendition, POSTER_RENDITION_NAME, AUDIO_RENDITION_NAME, WEB_VIDEO_RENDITION_NAME, ContentNature } from '@vertesia/common';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError, InvalidContentTypeError } from '../../errors.js';
import { saveBlobToTempFile } from '../../utils/blobs.js';
import { VertesiaClient } from '@vertesia/client';
import { RequestError } from '@vertesia/api-fetch-client';

const execAsync = promisify(exec);

// Default configuration constants
const DEFAULT_MAX_RESOLUTION = 1920; // Max resolution for video rendition (produces 1080p)
const DEFAULT_THUMBNAIL_SIZE = 256; // Thumbnail longest side in pixels
const DEFAULT_POSTER_SIZE = 1920; // Poster longest side in pixels
const DEFAULT_GENERATE_AUDIO = true; // Generate audio-only rendition by default

// Timestamp calculation constants for screenshots
const THUMBNAIL_TIMESTAMP_RATIO = 0.25; // Extract thumbnail at 25% of video duration
const POSTER_TIMESTAMP_RATIO = 0.05; // Extract poster at 5% of video duration
const POSTER_TIMESTAMP_MAX = 2; // Maximum poster timestamp in seconds
const MIN_SCREENSHOT_TIMESTAMP = 1; // Minimum timestamp for screenshots in seconds

// FFmpeg configuration constants
const FFMPEG_MAX_BUFFER = 1024 * 1024 * 10; // 10MB buffer for ffmpeg output
const VIDEO_CRF = '23'; // Constant Rate Factor for video quality (18-28, lower = better)
const AUDIO_BITRATE = '128k'; // Audio bitrate for AAC encoding
const JPEG_QUALITY = '2'; // JPEG quality for screenshots (1-31, lower = better)

export interface PrepareVideoParams {
    maxResolution?: number; // Max resolution (longest side) for video rendition, default 1920 (produces 1080p: 1920x1080 landscape or 1080x1920 portrait)
    thumbnailSize?: number; // Max size (longest side) for thumbnail image, default 256
    posterSize?: number; // Max size (longest side) for poster image, default 1920
    generateAudio?: boolean; // Generate audio-only rendition (AAC), default true
}

export interface PrepareVideo extends DSLActivitySpec<PrepareVideoParams> {
    name: 'prepareVideo';
}

interface VideoMetadataExtended {
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
async function getVideoMetadata(videoPath: string): Promise<VideoMetadataExtended> {
    try {
        const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        const { stdout } = await execAsync(command);
        const metadata = JSON.parse(stdout) as FFProbeOutput;

        const videoStream = metadata.streams.find(
            (stream) => stream.codec_type === 'video',
        );

        if (!videoStream) {
            throw new Error('No video stream found in file');
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
        const audioStream = metadata.streams.find(
            (stream) => stream.codec_type === 'audio',
        );
        const hasAudio = !!audioStream;

        return { duration, width, height, codec, bitrate, fps, hasAudio };
    } catch (error) {
        log.error(
            `Failed to get video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw new Error(
            `Failed to probe video metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
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

interface MediaResult {
    file: string;
    width: number;
    height: number;
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
    renditions: VideoRendition[];
    status: 'success';
}

/**
 * Generate a video rendition with resolution limited to maxResolution (e.g., 1080p)
 * Uses H.264 codec for broad compatibility
 */
async function generateVideoRendition(
    videoPath: string,
    outputDir: string,
    metadata: VideoMetadataExtended,
    maxResolution: number,
): Promise<MediaResult | null> {
    const outputFile = path.join(outputDir, `rendition_${maxResolution}p.mp4`);

    // Calculate scaled dimensions
    const dimensions = calculateScaledDimensions(metadata.width, metadata.height, maxResolution);

    log.info(`Video rendition dimensions: ${metadata.width}x${metadata.height} -> ${dimensions.width}x${dimensions.height}`);

    const scaleFilter = `scale=${dimensions.width}:${dimensions.height}`;

    const command = [
        'ffmpeg',
        '-y', // Overwrite output
        '-i', `"${videoPath}"`,
        '-vf', `"${scaleFilter}"`,
        '-c:v', 'libx264', // H.264 codec
        '-preset', 'medium', // Balance between speed and compression
        '-crf', VIDEO_CRF, // Constant Rate Factor (18-28, lower = better quality)
        '-c:a', 'aac', // Audio codec
        '-b:a', AUDIO_BITRATE, // Audio bitrate
        '-movflags', '+faststart', // Enable streaming
        '-max_muxing_queue_size', '1024', // Prevent muxing issues
        `"${outputFile}"`,
    ].join(' ');

    log.info(`Generating ${maxResolution}p video rendition`, { command });

    try {
        const { stderr } = await execAsync(command, { maxBuffer: FFMPEG_MAX_BUFFER });

        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for video rendition: ${stderr}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.info(`Generated ${maxResolution}p video rendition: ${outputFile}`);
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
        log.error(
            `Failed to generate video rendition: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return null;
    }
}

/**
 * Extract audio track from video as AAC audio file
 */
async function generateAudioRendition(
    videoPath: string,
    outputDir: string,
): Promise<string | null> {
    const outputFile = path.join(outputDir, 'audio.m4a');

    const command = [
        'ffmpeg',
        '-y', // Overwrite output
        '-i', `"${videoPath}"`,
        '-vn', // No video
        '-c:a', 'aac', // Audio codec
        '-b:a', AUDIO_BITRATE, // Audio bitrate
        `"${outputFile}"`,
    ].join(' ');

    log.info('Generating audio-only rendition', { command });

    try {
        const { stderr } = await execAsync(command, { maxBuffer: FFMPEG_MAX_BUFFER });

        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for audio rendition: ${stderr}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.info(`Generated audio rendition: ${outputFile}`);
            return outputFile;
        } catch {
            log.warn('Audio rendition not generated');
            return null;
        }
    } catch (error) {
        log.error(
            `Failed to generate audio rendition: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return null;
    }
}

/**
 * Extract a screenshot frame from the video at a specific timestamp
 */
async function generateScreenshot(
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
        'ffmpeg',
        '-y',
        '-ss', timestamp.toString(),
        '-i', `"${videoPath}"`,
        '-vframes', '1',
        '-vf', `"${scaleFilter}"`,
        '-q:v', JPEG_QUALITY, // High quality JPEG
        `"${outputFile}"`,
    ].join(' ');

    log.info(`Generating ${name} at ${timestamp}s`, { command });

    try {
        const { stderr } = await execAsync(command);

        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for ${name}: ${stderr}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.info(`Generated ${name}: ${outputFile}`);
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
        log.error(
            `Failed to generate ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return null;
    }
}

/**
 * Upload a file to the storage and return its URI
 */
async function uploadFile(
    client: VertesiaClient,
    filePath: string,
    mimeType: string,
    fileName: string,
    storagePath: string,
): Promise<string> {
    const { NodeStreamSource } = await import('@vertesia/client/node');
    const fileStream = fs.createReadStream(filePath);
    const source = new NodeStreamSource(fileStream, fileName, mimeType, storagePath);

    const result = await client.files.uploadFile(source);
    log.info(`Uploaded file to ${storagePath}`, { result });

    return result;
}

/**
 * Upload a media result and create a rendition entry
 */
async function uploadMediaAsRendition(
    client: VertesiaClient,
    result: MediaResult,
    renditionName: string,
    fileName: string,
    mimeType: string,
    etag: string,
    pathSegment: string,
): Promise<VideoRendition> {
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
 * Main activity: Prepare video by extracting metadata and generating renditions
 */
export async function prepareVideo(
    payload: DSLActivityExecutionPayload<PrepareVideoParams>,
): Promise<PrepareVideoResult> {
    const {
        client,
        objectId,
        params,
    } = await setupActivity<PrepareVideoParams>(payload);

    const maxResolution = params.maxResolution ?? DEFAULT_MAX_RESOLUTION;
    const thumbnailSize = params.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE;
    const posterSize = params.posterSize ?? DEFAULT_POSTER_SIZE;
    const generateAudio = params.generateAudio ?? DEFAULT_GENERATE_AUDIO;

    log.info(`Preparing video for ${objectId}`, {
        maxResolution,
        thumbnailSize,
        posterSize,
    });

    // Retrieve the content object
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

    if (!inputObject.content.type || !inputObject.content.type.startsWith('video/')) {
        log.error(`Document ${objectId} is not a video: ${inputObject.content.type}`);
        throw new InvalidContentTypeError(
            objectId,
            'video/*',
            inputObject.content.type || 'unknown',
        );
    }

    // Download video to temp file
    const videoFile = await saveBlobToTempFile(client, inputObject.content.source);
    const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-video-'));

    try {
        // Step 1: Extract video metadata
        log.info('Extracting video metadata');
        const metadata = await getVideoMetadata(videoFile);

        // Step 2: Generate video rendition
        log.info('Generating video rendition');
        const renditionResult = await generateVideoRendition(
            videoFile,
            tempOutputDir,
            metadata,
            maxResolution,
        );

        // Step 3 & 4: Generate thumbnail and poster in parallel
        log.info('Generating thumbnail and poster');
        const thumbnailTimestamp = Math.max(metadata.duration * THUMBNAIL_TIMESTAMP_RATIO, MIN_SCREENSHOT_TIMESTAMP);
        const posterTimestamp = Math.max(Math.min(metadata.duration * POSTER_TIMESTAMP_RATIO, POSTER_TIMESTAMP_MAX), MIN_SCREENSHOT_TIMESTAMP);

        const [thumbnailResult, posterResult] = await Promise.all([
            generateScreenshot(
                videoFile,
                tempOutputDir,
                thumbnailTimestamp,
                thumbnailSize,
                'thumbnail',
                metadata,
            ),
            generateScreenshot(
                videoFile,
                tempOutputDir,
                posterTimestamp,
                posterSize,
                'poster',
                metadata,
            ),
        ]);

        // Step 5: Generate audio rendition (if video has audio and requested)
        let audioFile: string | null = null;
        if (generateAudio && metadata.hasAudio) {
            log.info('Generating audio rendition');
            audioFile = await generateAudioRendition(videoFile, tempOutputDir);
        } else if (generateAudio && !metadata.hasAudio) {
            log.info('Skipping audio rendition - video has no audio track');
        }

        // Step 6: Upload generated files
        const renditions: VideoRendition[] = [];
        const etag = inputObject.content.etag ?? inputObject.id;

        if (renditionResult) {
            const videoRendition = await uploadMediaAsRendition(
                client,
                renditionResult,
                WEB_VIDEO_RENDITION_NAME,
                `${maxResolution}px.mp4`,
                'video/mp4',
                etag,
                'video',
            );
            renditions.push(videoRendition);
        }

        if (thumbnailResult) {
            const fileName = 'thumbnail.jpg';
            const storagePath = `renditions/${etag}/${thumbnailSize}/${fileName}`;
            await uploadFile(
                client,
                thumbnailResult.file,
                'image/jpeg',
                fileName,
                storagePath,
            );
        }

        if (posterResult) {
            const posterRendition = await uploadMediaAsRendition(
                client,
                posterResult,
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

        // Step 7: Update content object with metadata and renditions
        const videoMetadata: VideoMetadata = {
            type: ContentNature.Video,
            duration: metadata.duration,
            dimensions: {
                width: metadata.width,
                height: metadata.height,
            },
            renditions,
            hasAudio: metadata.hasAudio,
            generation_runs: inputObject.metadata?.generation_runs || [],
        };

        await client.objects.update(objectId, {
            metadata: videoMetadata,
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
            metadata: {
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                codec: metadata.codec,
                bitrate: metadata.bitrate,
                fps: metadata.fps,
                hasAudio: metadata.hasAudio,
            },
            renditions: renditions,
            status: 'success',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Error preparing video: ${errorMessage}`, { error });

        // Re-throw known errors as-is
        if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
            throw error;
        }

        // Wrap unknown errors in Error
        throw new Error(
            `Failed to prepare video ${objectId}: ${errorMessage}`,
        );
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
