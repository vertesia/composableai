import { log } from '@temporalio/activity';
import { DSLActivityExecutionPayload, DSLActivitySpec, AudioMetadata, AUDIO_RENDITION_NAME, ContentNature, Rendition } from '@vertesia/common';
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
const DEFAULT_AUDIO_BITRATE = '128k'; // Default audio bitrate for AAC encoding
const FFMPEG_MAX_BUFFER = 1024 * 1024 * 10; // 10MB buffer for ffmpeg output

export interface PrepareAudioParams {
    audioBitrate?: string; // Audio bitrate for AAC encoding, default '128k'
}

export interface PrepareAudio extends DSLActivitySpec<PrepareAudioParams> {
    name: 'prepareAudio';
}

interface AudioMetadataExtended {
    duration: number;
    codec: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
}

interface FFProbeStream {
    codec_type: string;
    codec_name?: string;
    sample_rate?: string;
    channels?: number;
    bit_rate?: string;
}

interface FFProbeFormat {
    duration?: string;
    bit_rate?: string;
}

interface FFProbeOutput {
    streams: FFProbeStream[];
    format: FFProbeFormat;
}

export interface PrepareAudioMetadata {
    duration: number;
    codec: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
}

export interface PrepareAudioResult {
    objectId: string;
    metadata: PrepareAudioMetadata;
    renditions: Rendition[];
    status: 'success';
}

/**
 * Extract comprehensive audio metadata using ffprobe
 */
async function getAudioMetadata(audioPath: string): Promise<AudioMetadataExtended> {
    try {
        const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`;
        const { stdout } = await execAsync(command);
        const metadata = JSON.parse(stdout) as FFProbeOutput;

        const audioStream = metadata.streams.find(
            (stream) => stream.codec_type === 'audio',
        );

        if (!audioStream) {
            throw new Error('No audio stream found in file');
        }

        const duration = parseFloat(metadata.format.duration ?? '0') || 0;
        const codec = audioStream.codec_name || 'unknown';
        const bitrate = parseInt(audioStream.bit_rate ?? metadata.format.bit_rate ?? '0', 10) || 0;
        const sampleRate = parseInt(audioStream.sample_rate ?? '0', 10) || 0;
        const channels = audioStream.channels || 0;

        return { duration, codec, bitrate, sampleRate, channels };
    } catch (error) {
        log.error(
            `Failed to get audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw new Error(
            `Failed to probe audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

/**
 * Generate a web-compatible audio rendition (AAC in M4A container)
 * Ensures broad browser compatibility for HTML5 audio playback
 */
async function generateAudioRendition(
    audioPath: string,
    outputDir: string,
    audioBitrate: string,
): Promise<string | null> {
    const outputFile = path.join(outputDir, 'audio.m4a');

    const command = [
        'ffmpeg',
        '-y', // Overwrite output
        '-i', `"${audioPath}"`,
        '-c:a', 'aac', // AAC codec
        '-b:a', audioBitrate, // Audio bitrate
        '-movflags', '+faststart', // Enable streaming
        `"${outputFile}"`,
    ].join(' ');

    log.info('Generating web audio rendition (AAC M4A)', { command, audioBitrate });

    try {
        const { stderr } = await execAsync(command, { maxBuffer: FFMPEG_MAX_BUFFER });

        if (stderr && !stderr.includes('frame=')) {
            log.debug(`FFmpeg stderr for audio rendition: ${stderr}`);
        }

        // Verify output file was created
        try {
            await fs.promises.access(outputFile, fs.constants.F_OK);
            log.info(`Generated web audio rendition: ${outputFile}`);
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
 * Upload audio file and create a rendition entry
 */
async function uploadAudioAsRendition(
    client: VertesiaClient,
    audioFile: string,
    renditionName: string,
    fileName: string,
    mimeType: string,
    etag: string,
): Promise<Rendition> {
    const storagePath = `renditions/${etag}/audio/${fileName}`;
    const uri = await uploadFile(client, audioFile, mimeType, fileName, storagePath);

    return {
        name: renditionName,
        content: {
            source: uri,
            type: mimeType,
            name: fileName,
        },
    };
}

/**
 * Main activity: Prepare audio by extracting metadata and generating web rendition
 */
export async function prepareAudio(
    payload: DSLActivityExecutionPayload<PrepareAudioParams>,
): Promise<PrepareAudioResult> {
    const {
        client,
        objectId,
        params,
    } = await setupActivity<PrepareAudioParams>(payload);

    const audioBitrate = params.audioBitrate ?? DEFAULT_AUDIO_BITRATE;

    log.info(`Preparing audio for ${objectId}`, { audioBitrate });

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

    if (!inputObject.content.type || !inputObject.content.type.startsWith('audio/')) {
        log.error(`Document ${objectId} is not an audio file: ${inputObject.content.type}`);
        throw new InvalidContentTypeError(
            objectId,
            'audio/*',
            inputObject.content.type || 'unknown',
        );
    }

    // Download audio to temp file
    const audioFile = await saveBlobToTempFile(client, inputObject.content.source);
    const tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-audio-'));

    try {
        // Step 1: Extract audio metadata
        log.info('Extracting audio metadata');
        const metadata = await getAudioMetadata(audioFile);

        // Step 2: Generate web audio rendition (AAC M4A)
        log.info('Generating web audio rendition');
        const renditionFile = await generateAudioRendition(
            audioFile,
            tempOutputDir,
            audioBitrate,
        );

        // Step 3: Upload generated rendition
        const renditions: Rendition[] = [];
        const etag = inputObject.content.etag ?? inputObject.id;

        if (renditionFile) {
            const audioRendition = await uploadAudioAsRendition(
                client,
                renditionFile,
                AUDIO_RENDITION_NAME,
                'audio.m4a',
                'audio/mp4',
                etag,
            );
            renditions.push(audioRendition);
        }

        // Step 4: Update content object with metadata and renditions
        const audioMetadata: AudioMetadata = {
            type: ContentNature.Audio,
            duration: metadata.duration,
            renditions,
            generation_runs: inputObject.metadata?.generation_runs || [],
        };

        await client.objects.update(objectId, {
            metadata: audioMetadata,
        });

        log.info(`Successfully prepared audio ${objectId}`, {
            duration: metadata.duration,
            codec: metadata.codec,
            bitrate: metadata.bitrate,
            sampleRate: metadata.sampleRate,
            channels: metadata.channels,
            renditionsGenerated: renditions.length,
        });

        return {
            objectId,
            metadata: {
                duration: metadata.duration,
                codec: metadata.codec,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                channels: metadata.channels,
            },
            renditions: renditions,
            status: 'success',
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Error preparing audio: ${errorMessage}`, { error });

        // Re-throw known errors as-is
        if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
            throw error;
        }

        // Wrap unknown errors in Error
        throw new Error(
            `Failed to prepare audio ${objectId}: ${errorMessage}`,
        );
    } finally {
        // Clean up temporary files
        const cleanupPromises: Promise<void>[] = [];

        if (audioFile) {
            cleanupPromises.push(
                fs.promises.unlink(audioFile).catch((err) => {
                    log.warn(`Failed to cleanup audio file: ${audioFile}`, { err });
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
