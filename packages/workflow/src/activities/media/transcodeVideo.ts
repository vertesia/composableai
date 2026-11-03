import { ApplicationFailure, log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import type {
    ContentObject,
    DSLActivityExecutionPayload,
    DSLActivitySpec,
    RenditionWithDimensions,
    VideoMetadata,
} from '@vertesia/common';
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

const GiB = 1024 ** 3;

/** Ephemeral storage assumed when WORKER_EPHEMERAL_STORAGE_BYTES is not set. */
const DEFAULT_EPHEMERAL_STORAGE_BYTES = 10 * GiB;

/** Kept free of the transcode for the container's own writes (logs, the worker's temp files). */
const EPHEMERAL_STORAGE_HEADROOM_BYTES = GiB;

/** Upper estimate of the web rendition's bitrate (1080p H.264 at CRF 23 plus AAC audio), for sizing its file. */
const WEB_RENDITION_ESTIMATED_BITS_PER_SECOND = 12_000_000;

/** Failure `type` of a transcode whose source and output would not fit in the worker's ephemeral storage. */
export const TRANSCODE_EXCEEDS_DISK_BUDGET = 'TranscodeExceedsDiskBudget';

/**
 * Disk the transcode may use: the container's ephemeral storage (WORKER_EPHEMERAL_STORAGE_BYTES, in bytes) less
 * headroom. A container that writes past its ephemeral storage is evicted, which loses the attempt only after its
 * heartbeat times out, and every retry is evicted the same way.
 */
export function transcodeDiskBudgetBytes(env: NodeJS.ProcessEnv = process.env): number {
    const configured = Number(env.WORKER_EPHEMERAL_STORAGE_BYTES);
    const storage = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_EPHEMERAL_STORAGE_BYTES;
    return storage - EPHEMERAL_STORAGE_HEADROOM_BYTES;
}

/**
 * Disk a transcode needs: the downloaded source plus the rendition. The rendition is sized from the duration when it
 * is known, and as twice the source otherwise (an already-compressed upload can grow when re-encoded).
 */
export function estimateTranscodeDiskBytes(sourceBytes: number, durationSeconds: number | undefined): number {
    const renditionBytes =
        durationSeconds && durationSeconds > 0
            ? (durationSeconds * WEB_RENDITION_ESTIMATED_BITS_PER_SECOND) / 8
            : sourceBytes * 2;
    return sourceBytes + renditionBytes;
}

async function sourceSizeBytes(client: VertesiaClient, object: ContentObject): Promise<number | undefined> {
    const source = object.content?.source as string;
    try {
        return (await client.files.getMetadata(source)).size;
    } catch (error) {
        log.warn(`Could not read the size of ${source}`, { error });
        const size = object.metadata?.size;
        return typeof size === 'number' && size > 0 ? size : undefined;
    }
}

/**
 * Fail without retrying when the source and rendition would not fit on disk, before downloading anything.
 */
async function assertFitsOnDisk(client: VertesiaClient, object: ContentObject): Promise<void> {
    const sourceBytes = await sourceSizeBytes(client, object);
    if (sourceBytes === undefined) {
        log.warn(`Size of the source of ${object.id} is unknown; transcoding without a disk check`);
        return;
    }
    const duration = (object.metadata as VideoMetadata | undefined)?.duration;
    const needed = estimateTranscodeDiskBytes(sourceBytes, duration);
    const budget = transcodeDiskBudgetBytes();
    if (needed > budget) {
        const toGiB = (bytes: number) => (bytes / GiB).toFixed(1);
        throw ApplicationFailure.nonRetryable(
            `Transcoding ${object.id} needs about ${toGiB(needed)} GiB of disk (source ${toGiB(sourceBytes)} GiB), ` +
                `more than the ${toGiB(budget)} GiB available`,
            TRANSCODE_EXCEEDS_DISK_BUDGET,
        );
    }
}

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
 * writing the object's metadata. Fails with {@link TRANSCODE_EXCEEDS_DISK_BUDGET}, before downloading, when the source
 * and rendition would not fit in the worker's ephemeral storage.
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
    await assertFitsOnDisk(client, inputObject);

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
