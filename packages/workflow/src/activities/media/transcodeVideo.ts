import { ApplicationFailure, Context, log } from '@temporalio/activity';
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
import {
    initializeActivityCommandDeadline,
    isActivityDeadlineExceeded,
    isUnusableVideoContent,
    rethrowIfActivityStopped,
    TRANSCODE_EXCEEDS_TIME_BUDGET,
} from './exec.js';
import {
    calculateScaledDimensions,
    DEFAULT_MAX_RESOLUTION,
    FASTEST_VIDEO_PRESET,
    generateRenditionWithDimensions,
    getVideoMetadata,
    presetForAttempt,
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

/** Pixels in a 1080p frame, the size the realtime factor is stated for. */
const PIXELS_1080P = 1920 * 1080;

/**
 * How many seconds of 1080p video a transcode is assumed to encode per second of wall time when no
 * WORKER_TRANSCODE_REALTIME_FACTOR is set. A dedicated multi-core worker encodes the veryfast preset several times
 * faster than realtime; 2 is below that on purpose, so the pre-check rejects only transcodes that clearly cannot
 * finish. The in-flight check catches slower encodes from their measured speed.
 */
const DEFAULT_TRANSCODE_REALTIME_FACTOR = 2;

/** Part of the Activity's run time kept free for the download, upload and probe around the encode. */
const TRANSCODE_TIME_MARGIN_MS = 5 * 60_000;

/** WORKER_TRANSCODE_REALTIME_FACTOR, or the default when it is unset or not a positive number. */
export function transcodeRealtimeFactor(env: NodeJS.ProcessEnv = process.env): number {
    const configured = Number(env.WORKER_TRANSCODE_REALTIME_FACTOR);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TRANSCODE_REALTIME_FACTOR;
}

/** Estimated encode time of `durationSeconds` of video at `width`×`height`, scaled from the 1080p realtime factor. */
export function estimateTranscodeMs(
    durationSeconds: number,
    width: number,
    height: number,
    realtimeFactor: number,
): number {
    return ((durationSeconds * ((width * height) / PIXELS_1080P)) / realtimeFactor) * 1000;
}

/**
 * Fail without retrying, before downloading, when the encode alone is estimated to outlast the Activity's run time.
 * A transcode that times out would be retried, and every retry would time out the same way.
 */
function assertFitsInTime(object: ContentObject, maxResolution: number): void {
    const metadata = object.metadata as VideoMetadata | undefined;
    const duration = metadata?.duration;
    const width = metadata?.dimensions?.width;
    const height = metadata?.dimensions?.height;
    if (!duration || !width || !height) {
        log.warn(`Duration or dimensions of ${object.id} are unknown; transcoding without a time pre-check`);
        return;
    }
    const output = calculateScaledDimensions(width, height, maxResolution);
    const estimateMs = estimateTranscodeMs(duration, output.width, output.height, transcodeRealtimeFactor());
    const budgetMs = Context.current().info.startToCloseTimeoutMs - TRANSCODE_TIME_MARGIN_MS;
    if (estimateMs > budgetMs) {
        const minutes = (ms: number) => Math.round(ms / 60_000);
        throw ApplicationFailure.nonRetryable(
            `Transcoding ${object.id} (${Math.round(duration / 60)} min at ${output.width}x${output.height}) is ` +
                `estimated to take ${minutes(estimateMs)} min, more than the ${minutes(budgetMs)} min available`,
            TRANSCODE_EXCEEDS_TIME_BUDGET,
        );
    }
}

export interface TranscodeVideoParams {
    maxResolution?: number; // Max resolution (longest side) for the web rendition, default 1920 (1080p)
    videoPreset?: VideoPreset; // FFmpeg encoding preset, default veryfast; each retry moves one preset faster
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
 * writing the object's metadata. Fails without retrying, so a slow or oversized transcode does not burn every attempt:
 * - with {@link TRANSCODE_EXCEEDS_DISK_BUDGET}, before downloading, when the source and rendition would not fit in the
 *   worker's ephemeral storage;
 * - with TRANSCODE_EXCEEDS_TIME_BUDGET, before downloading, when the encode is estimated to outlast the Activity's run
 *   time, or during the encode, when its measured speed projects it past that time.
 */
export async function transcodeVideo(
    payload: DSLActivityExecutionPayload<TranscodeVideoParams>,
): Promise<TranscodeVideoResult> {
    initializeActivityCommandDeadline();
    const { client, objectId, params } = await setupActivity<TranscodeVideoParams>(payload);

    const maxResolution = params.maxResolution ?? DEFAULT_MAX_RESOLUTION;
    // A retry moves to a faster preset, so a transcode that keeps running into its deadline stops at the fastest one.
    const videoPreset = presetForAttempt(resolveVideoPreset(params.videoPreset), Context.current().info.attempt);

    log.debug(`Transcoding video for ${objectId}`, { maxResolution, videoPreset });

    const inputObject = await retrieveVideoObject(client, objectId);
    const source = inputObject.content?.source as string;
    await assertFitsOnDisk(client, inputObject);
    assertFitsInTime(inputObject, maxResolution);

    return await withVideoWorkspace(client, source, 'transcode-video-', async (videoFile, outputDir) => {
        try {
            const metadata = await getVideoMetadata(videoFile);
            // Whatever the Activity has left, less the margin for the upload, is the encode's budget.
            const encodeBudgetMs = initializeActivityCommandDeadline() - Date.now() - TRANSCODE_TIME_MARGIN_MS;
            const result = await generateRenditionWithDimensions(
                videoFile,
                outputDir,
                metadata,
                maxResolution,
                videoPreset,
                Math.max(1, encodeBudgetMs),
            );

            const rendition = result
                ? await uploadWebRendition(client, result, maxResolution, inputObject.content?.etag ?? inputObject.id)
                : null;

            log.info(`Transcoded video ${objectId}`, { generated: rendition !== null, videoPreset });

            return { objectId, rendition, etag: inputObject.content?.etag };
        } catch (error) {
            // The encode outlasted the Activity, typically because the duration was unknown so neither budget check
            // could run. Retry once more at a faster preset; at the fastest there is nothing left to try.
            if (isActivityDeadlineExceeded(error)) {
                if (videoPreset === FASTEST_VIDEO_PRESET) {
                    throw ApplicationFailure.nonRetryable(
                        `Transcoding ${objectId} did not finish within the Activity's run time, even at ${videoPreset}`,
                        TRANSCODE_EXCEEDS_TIME_BUDGET,
                    );
                }
                throw ApplicationFailure.retryable(
                    `Transcoding ${objectId} at ${videoPreset} did not finish within the Activity's run time; ` +
                        'retrying at a faster preset',
                    'TranscodeDeadlineExceeded',
                );
            }
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
