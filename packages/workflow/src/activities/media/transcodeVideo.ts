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
import { getBlobSize } from '../../utils/blobs.js';
import {
    initializeActivityCommandDeadline,
    isActivityDeadlineExceeded,
    isTranscodeExceedsTimeBudget,
    rethrowIfActivityStopped,
    TRANSCODE_EXCEEDS_TIME_BUDGET,
} from './exec.js';
import {
    calculateScaledDimensions,
    DEFAULT_MAX_RESOLUTION,
    FASTEST_VIDEO_PRESET,
    generateRenditionWithDimensions,
    getVideoMetadata,
    presetAfterDeadline,
    resolveVideoPreset,
    retrieveVideoObject,
    uploadWebRendition,
    VIDEO_PRESETS,
    type VideoMetadataExtended,
    type VideoPreset,
    withVideoSource,
} from './video.js';
import { PROCESSING_URL_MAX_TTL_SECONDS, type VideoInput } from './videoSource.js';

const GiB = 1024 ** 3;

/** Kept free of the transcode for the container's own writes (logs, the worker's temp files). */
const EPHEMERAL_STORAGE_HEADROOM_BYTES = GiB;

/** Pixels in a 1080p frame, the size the bitrate estimate and the realtime factor are stated for. */
const PIXELS_1080P = 1920 * 1080;

/**
 * Estimate of the web rendition's bitrate at 1080p (H.264 at CRF 23 plus AAC audio), for sizing its file. Typical
 * footage encodes well below it; it is scaled by the output's pixels for smaller renditions.
 */
const WEB_RENDITION_1080P_BITS_PER_SECOND = 8_000_000;

/** Failure `type` of a transcode whose output, and its source when downloaded, would not fit on the worker's disk. */
export const TRANSCODE_EXCEEDS_DISK_BUDGET = 'TranscodeExceedsDiskBudget';

/** Failure `type` of an attempt whose URL read failed too late to finish from a download; the retry downloads first. */
export const TRANSCODE_SOURCE_URL_FAILED = 'TranscodeSourceUrlFailed';

/**
 * Disk the transcode may use: the container's ephemeral storage (WORKER_EPHEMERAL_STORAGE_BYTES, in bytes) less
 * headroom, or undefined when the worker does not state it, so the transcode runs without a disk check. A container
 * that writes past its ephemeral storage is evicted, which loses the attempt only after its heartbeat times out, and
 * every retry is evicted the same way.
 */
export function transcodeDiskBudgetBytes(env: NodeJS.ProcessEnv = process.env): number | undefined {
    const configured = Number(env.WORKER_EPHEMERAL_STORAGE_BYTES);
    return Number.isFinite(configured) && configured > 0 ? configured - EPHEMERAL_STORAGE_HEADROOM_BYTES : undefined;
}

/**
 * Disk the rendition needs, sized from the duration and the output's pixels when both are known, and as twice the source
 * otherwise (an already-compressed upload can grow when re-encoded).
 */
export function estimateRenditionBytes(
    sourceBytes: number,
    durationSeconds: number | undefined,
    output?: { width: number; height: number },
): number {
    return durationSeconds && durationSeconds > 0 && output && output.width > 0 && output.height > 0
        ? (durationSeconds * WEB_RENDITION_1080P_BITS_PER_SECOND * ((output.width * output.height) / PIXELS_1080P)) / 8
        : sourceBytes * 2;
}

/** Disk a transcode from a downloaded source needs: the source plus the rendition. */
export function estimateTranscodeDiskBytes(
    sourceBytes: number,
    durationSeconds: number | undefined,
    output?: { width: number; height: number },
): number {
    return sourceBytes + estimateRenditionBytes(sourceBytes, durationSeconds, output);
}

/**
 * Size of the object's source: as the store reports it (`verified`), or as recorded on the object when the store
 * cannot say, as for an HTTPS source or a failed lookup.
 */
async function sourceSize(
    client: VertesiaClient,
    object: ContentObject,
): Promise<{ bytes: number | undefined; verified: boolean }> {
    const stored = await getBlobSize(client, object.content?.source as string);
    if (stored !== undefined) {
        return { bytes: stored, verified: true };
    }
    const recorded = object.metadata?.size;
    return { bytes: typeof recorded === 'number' && recorded > 0 ? recorded : undefined, verified: false };
}

/** The disk a transcode may use and the estimated sizes of what it writes there. */
interface TranscodeDiskNeed {
    objectId: string;
    budgetBytes: number;
    sourceBytes: number;
    renditionBytes: number;
}

/** The transcode's disk budget and needs, or undefined when the budget or the source size is unknown. */
function transcodeDiskNeed(
    object: ContentObject,
    sourceBytes: number | undefined,
    maxResolution: number,
): TranscodeDiskNeed | undefined {
    const budgetBytes = transcodeDiskBudgetBytes();
    if (budgetBytes === undefined) {
        log.debug('WORKER_EPHEMERAL_STORAGE_BYTES is not set; transcoding without a disk check');
        return undefined;
    }
    if (sourceBytes === undefined) {
        log.warn(`Size of the source of ${object.id} is unknown; transcoding without a disk check`);
        return undefined;
    }
    const metadata = object.metadata as VideoMetadata | undefined;
    const width = metadata?.dimensions?.width;
    const height = metadata?.dimensions?.height;
    const output = width && height ? calculateScaledDimensions(width, height, maxResolution) : undefined;
    const renditionBytes = estimateRenditionBytes(sourceBytes, metadata?.duration, output);
    return { objectId: object.id, budgetBytes, sourceBytes, renditionBytes };
}

/**
 * The non-retryable failure of a transcode that would not fit on disk, or undefined when it fits. A transcode over the
 * signed URL writes only the rendition; one from a download also holds the source. `urlError` is the failed URL read
 * the download would replace, quoted in the failure.
 */
function diskBudgetFailure(
    need: TranscodeDiskNeed | undefined,
    { downloaded, urlError }: { downloaded: boolean; urlError?: unknown },
): ApplicationFailure | undefined {
    if (!need) {
        return undefined;
    }
    const neededBytes = need.renditionBytes + (downloaded ? need.sourceBytes : 0);
    if (neededBytes <= need.budgetBytes) {
        return undefined;
    }
    const toGiB = (bytes: number) => (bytes / GiB).toFixed(1);
    const from = downloaded ? `downloading its ${toGiB(need.sourceBytes)} GiB source` : 'reading it over its URL';
    const after =
        urlError === undefined
            ? ''
            : `, after reading its URL failed (${urlError instanceof Error ? urlError.message : String(urlError)}),`;
    return ApplicationFailure.nonRetryable(
        `Transcoding ${need.objectId} by ${from}${after} needs about ${toGiB(neededBytes)} GiB of disk, ` +
            `more than the ${toGiB(need.budgetBytes)} GiB available`,
        TRANSCODE_EXCEEDS_DISK_BUDGET,
    );
}

/**
 * How many seconds of 1080p video a transcode is assumed to encode per second of wall time when no
 * WORKER_TRANSCODE_REALTIME_FACTOR is set. A dedicated multi-core worker encodes the veryfast preset several times
 * faster than realtime; 2 is below that on purpose, so the pre-check rejects only transcodes that clearly cannot
 * finish. The in-flight check catches slower encodes from their measured speed.
 */
const DEFAULT_TRANSCODE_REALTIME_FACTOR = 2;

/**
 * Part of the Activity's run time kept free for the download, upload and probe around the encode: 5 minutes, or a
 * tenth of a shorter run time, so a short Start-to-Close timeout still leaves the encode a budget.
 */
function transcodeTimeMarginMs(startToCloseTimeoutMs: number): number {
    return Math.min(5 * 60_000, startToCloseTimeoutMs / 10);
}

/** What the Activity has left for an encode starting now, less the margin for the upload. */
function remainingEncodeBudgetMs(): number {
    return (
        initializeActivityCommandDeadline() -
        Date.now() -
        transcodeTimeMarginMs(Context.current().info.startToCloseTimeoutMs)
    );
}

/**
 * Lifetime to sign the source URL for: the whole Activity, up to the 24 hours the processing route grants, so an encode
 * that reads the source front to back for most of the run never meets an expired signature when it reconnects.
 */
export function sourceUrlTtlSeconds(startToCloseTimeoutMs: number): number {
    return Math.min(PROCESSING_URL_MAX_TTL_SECONDS, Math.max(1, Math.ceil(startToCloseTimeoutMs / 1000)));
}

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
 * Fail without retrying, before reading the source, when the encode alone is estimated to outlast the Activity's run
 * time. A transcode that times out would be retried, and every retry would time out the same way. Returns the
 * estimated encode time, or 0 when the duration or dimensions are unknown.
 */
function assertFitsInTime(object: ContentObject, maxResolution: number): number {
    const metadata = object.metadata as VideoMetadata | undefined;
    const duration = metadata?.duration;
    const width = metadata?.dimensions?.width;
    const height = metadata?.dimensions?.height;
    if (!duration || !width || !height) {
        log.warn(`Duration or dimensions of ${object.id} are unknown; transcoding without a time pre-check`);
        return 0;
    }
    const output = calculateScaledDimensions(width, height, maxResolution);
    const estimateMs = estimateTranscodeMs(duration, output.width, output.height, transcodeRealtimeFactor());
    const { startToCloseTimeoutMs } = Context.current().info;
    const budgetMs = startToCloseTimeoutMs - transcodeTimeMarginMs(startToCloseTimeoutMs);
    if (estimateMs > budgetMs) {
        const minutes = (ms: number) => Math.round(ms / 60_000);
        throw ApplicationFailure.nonRetryable(
            `Transcoding ${object.id} (${Math.round(duration / 60)} min at ${output.width}x${output.height}) is ` +
                `estimated to take ${minutes(estimateMs)} min, more than the ${minutes(budgetMs)} min available`,
            TRANSCODE_EXCEEDS_TIME_BUDGET,
        );
    }
    return estimateMs;
}

/** Heartbeat details an attempt leaves for the next attempt of this Activity. */
interface TranscodeHeartbeatDetails {
    /** The preset an encode ran into the deadline at. */
    deadlinePreset?: VideoPreset;
    /** Reading the source over its URL failed, so later attempts download it from the start. */
    downloadSource?: boolean;
}

/** What earlier attempts of this Activity left in their last heartbeat, keeping only well-formed fields. */
function previousHeartbeatDetails(): TranscodeHeartbeatDetails {
    const details = Context.current().info.heartbeatDetails as TranscodeHeartbeatDetails | undefined;
    const preset = details?.deadlinePreset;
    return {
        deadlinePreset: (VIDEO_PRESETS as readonly unknown[]).includes(preset) ? preset : undefined,
        downloadSource: details?.downloadSource === true ? true : undefined,
    };
}

export interface TranscodeVideoParams {
    maxResolution?: number; // Max resolution (longest side) for the web rendition, default 1920 (1080p)
    videoPreset?: VideoPreset; // FFmpeg encoding preset, default veryfast; a retry after a deadline moves one faster
    // The content etag the intake prepared the video's other assets from. When the content has changed since, nothing is
    // transcoded: the intake the change started transcodes the new content.
    etag?: string;
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
 * ffmpeg reads the source over a signed URL valid for the whole Activity, so only the rendition is written to disk.
 * When the URL cannot be signed or reading it fails, the source is downloaded and the encode runs again on the copy.
 * A fallback with too little time left to encode again is retried instead, and later attempts download the source
 * from the start.
 *
 * Writes nothing to the object: the caller stores the returned rendition with addObjectRendition once no other step is
 * writing the object's metadata. Fails without retrying, so a slow or oversized transcode does not burn every attempt:
 * - with {@link TRANSCODE_EXCEEDS_DISK_BUDGET}, before reading the source, when the rendition (and the source, for an
 *   attempt that downloads it) would not fit in the worker's ephemeral storage, and before a fallback download that
 *   would not fit beside the rendition;
 * - with TRANSCODE_EXCEEDS_TIME_BUDGET, before reading the source, when the encode is estimated to outlast the
 *   Activity's run time, or during the encode, when its measured speed projects it past that time.
 */
export async function transcodeVideo(
    payload: DSLActivityExecutionPayload<TranscodeVideoParams>,
): Promise<TranscodeVideoResult> {
    initializeActivityCommandDeadline();
    const { client, objectId, params } = await setupActivity<TranscodeVideoParams>(payload);

    const maxResolution = params.maxResolution ?? DEFAULT_MAX_RESOLUTION;
    const previous = previousHeartbeatDetails();
    // A retry after a deadline moves to a faster preset, so a transcode that keeps running into its deadline stops at
    // the fastest one. Retries for other reasons keep the preset.
    const videoPreset = presetAfterDeadline(resolveVideoPreset(params.videoPreset), previous.deadlinePreset);

    log.debug(`Transcoding video for ${objectId}`, { maxResolution, videoPreset });

    const inputObject = await retrieveVideoObject(client, objectId);
    if (params.etag && inputObject.content?.etag !== params.etag) {
        log.info(`Content of ${objectId} changed since its intake started; not transcoding it`);
        return { objectId, rendition: null, etag: params.etag };
    }
    const source = inputObject.content?.source as string;
    const size = await sourceSize(client, inputObject);
    // The media size limit is checked from the store's size before any read. Without one, only the capped download
    // enforces it, so the source is downloaded rather than read whole over the URL.
    const downloadFirst = previous.downloadSource === true || !size.verified;
    if (!size.verified) {
        log.info(`The store does not report the size of the source of ${objectId}; downloading it to transcode`);
    }
    const diskNeed = transcodeDiskNeed(inputObject, size.bytes, maxResolution);
    const preCheck = diskBudgetFailure(diskNeed, { downloaded: downloadFirst });
    if (preCheck) {
        throw preCheck;
    }
    const encodeEstimateMs = assertFitsInTime(inputObject, maxResolution);

    // What this attempt leaves for the next one. The worker flushes the last heartbeat before reporting a failure.
    const details: TranscodeHeartbeatDetails = { ...previous };
    const recordDownload = () => {
        // A retry downloads the source from the start, so a fallback's lost time is not lost again.
        details.downloadSource = true;
        Context.current().heartbeat({ ...details });
    };
    let encodedOverUrl = false;
    // Set when an encode over the URL failed and the same encode is running again on the download.
    let encodeFellBack = false;

    const beforeDownload = (urlError: unknown) => {
        // Over the URL only the rendition was counted; a download must fit beside it. A source that does not is too
        // large for this worker, as before the transcode read URLs. Retrying would read the URL again, and a failure
        // that recurs, such as content ffmpeg cannot decode, would fail every attempt.
        const failure = diskBudgetFailure(diskNeed, { downloaded: true, urlError });
        if (failure) {
            throw failure;
        }
        recordDownload();
        // A fallback that cannot finish in what the URL encode left would only spend the attempt downloading. The retry
        // downloads first, with the whole run time.
        if (encodedOverUrl && remainingEncodeBudgetMs() <= encodeEstimateMs) {
            throw ApplicationFailure.retryable(
                `Reading the source of ${objectId} over its URL failed with too little time left to download it and ` +
                    'encode again; retrying from the download',
                TRANSCODE_SOURCE_URL_FAILED,
            );
        }
    };

    const encode = (input: VideoInput, outputDir: string, metadata: VideoMetadataExtended) => {
        if (input.kind === 'url') {
            encodedOverUrl = true;
        } else if (encodedOverUrl) {
            encodeFellBack = true;
        }
        // Whatever the Activity has left, less the margin for the upload, is the encode's budget: a fallback encode
        // gets only what the failed one left.
        return generateRenditionWithDimensions(
            input,
            outputDir,
            metadata,
            maxResolution,
            videoPreset,
            Math.max(1, remainingEncodeBudgetMs()),
        );
    };

    return await withVideoSource(
        client,
        source,
        'transcode-video-',
        async (videoSource, outputDir) => {
            try {
                if (downloadFirst) {
                    await videoSource.localPath();
                }
                // The encode needs no duration, so a URL probe that finds none, as for browser-recorded WebM, is kept
                // rather than confirmed on a download.
                const metadata = await videoSource.withFallback((input) => getVideoMetadata(input));
                // A failed URL encode, including one that stalled, runs again on the download. Cancellation and the
                // time budget are not retried.
                const result = await videoSource.withFallback((input) => encode(input, outputDir, metadata));

                const rendition = result
                    ? await uploadWebRendition(
                          client,
                          result,
                          maxResolution,
                          inputObject.content?.etag ?? inputObject.id,
                      )
                    : null;

                log.info(`Transcoded video ${objectId}`, { generated: rendition !== null, videoPreset });

                return { objectId, rendition, etag: inputObject.content?.etag };
            } catch (error) {
                // The fallback encode ran out of the time the URL encode used. The retry downloads first, at the same
                // preset, with the whole run time.
                if (encodeFellBack && (isActivityDeadlineExceeded(error) || isTranscodeExceedsTimeBudget(error))) {
                    recordDownload();
                    throw ApplicationFailure.retryable(
                        `Transcoding ${objectId} from its download, after reading its URL failed, did not finish ` +
                            "within the Activity's run time; retrying from the download",
                        TRANSCODE_SOURCE_URL_FAILED,
                    );
                }
                // The encode outlasted the Activity, typically because the duration was unknown so neither budget
                // check could run. Retry once more at a faster preset; at the fastest there is nothing left to try.
                if (isActivityDeadlineExceeded(error)) {
                    if (videoPreset === FASTEST_VIDEO_PRESET) {
                        throw ApplicationFailure.nonRetryable(
                            `Transcoding ${objectId} did not finish within the Activity's run time, even at ${videoPreset}`,
                            TRANSCODE_EXCEEDS_TIME_BUDGET,
                        );
                    }
                    // The worker flushes this last heartbeat before reporting the failure, so the retry reads it.
                    details.deadlinePreset = videoPreset;
                    Context.current().heartbeat({ ...details });
                    throw ApplicationFailure.retryable(
                        `Transcoding ${objectId} at ${videoPreset} did not finish within the Activity's run time; ` +
                            'retrying at a faster preset',
                        'TranscodeDeadlineExceeded',
                    );
                }
                rethrowIfActivityStopped(error);
                // The disk check, the media size limit, an unusable source and the retry above keep their type and
                // retry flag.
                if (error instanceof ApplicationFailure) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                log.error(`Error transcoding video: ${errorMessage}`, { error });
                if (error instanceof DocumentNotFoundError || error instanceof InvalidContentTypeError) {
                    throw error;
                }
                throw new Error(`Failed to transcode video ${objectId}: ${errorMessage}`);
            }
        },
        { ttlSeconds: sourceUrlTtlSeconds(Context.current().info.startToCloseTimeoutMs), beforeDownload },
    );
}
