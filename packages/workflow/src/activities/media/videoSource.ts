import { Context, log } from '@temporalio/activity';
import type { VertesiaClient } from '@vertesia/client';
import { removeTempFiles, saveBlobToTempFile } from '../../utils/blobs.js';
import { getSourceLimits } from '../../utils/source-limits.js';
import {
    type CompletionBudget,
    execActivityFile,
    execActivityFileWithProgress,
    ffmpegInputThreadArgs,
    ffmpegOutputThreadArgs,
    isCommandStalled,
    parseTimestampSeconds,
    rethrowIfActivityStopped,
} from './exec.js';

/** Where ffmpeg or ffprobe reads a source video: a signed HTTP(S) URL, or a downloaded copy on local disk. */
export type VideoInput = { kind: 'url'; url: string } | { kind: 'file'; path: string };

/** Stand-in for a signed URL in logs and errors: its query string grants read access to the object. */
const REDACTED_URL = '<signed source URL>';

/**
 * Input options for a seekable HTTP(S) source. A seek before `-i` makes ffmpeg read the index and one keyframe group
 * with range requests. A dropped connection or a server error reconnects at the same offset; a 4xx such as an expired
 * signature does not, and fails the command so the caller can fall back to a download.
 */
export const HTTP_INPUT_OPTIONS: readonly string[] = [
    '-reconnect',
    '1',
    '-reconnect_on_network_error',
    '1',
    // Also reconnect if the server ever answers without range support.
    '-reconnect_streamed',
    '1',
    '-reconnect_on_http_error',
    '5xx',
    '-reconnect_delay_max',
    '8',
    // Microseconds: fail a read that stalls for 30s instead of hanging until the activity deadline.
    '-rw_timeout',
    '30000000',
];

/** The options that must precede `-i` (or ffprobe's positional input) for this input. */
export function videoInputOptions(input: VideoInput): string[] {
    return input.kind === 'url' ? [...HTTP_INPUT_OPTIONS] : [];
}

/** ffmpeg's input arguments for `input`: its options, then `-i` and its location. */
export function ffmpegInputArgs(input: VideoInput): string[] {
    return [...videoInputOptions(input), '-i', videoInputLocation(input)];
}

/**
 * ffmpeg arguments that grab one JPEG frame at `timestamp` seconds. The seek comes before `-i`, so a URL input is read
 * with range requests: the index and one keyframe group, not the whole file.
 */
export function buildFrameGrabArgs(
    input: VideoInput,
    outputFile: string,
    timestamp: number,
    scaleFilter: string,
): string[] {
    return [
        '-y',
        ...ffmpegInputThreadArgs(),
        '-ss',
        timestamp.toString(),
        ...ffmpegInputArgs(input),
        '-vframes',
        '1',
        '-vf',
        scaleFilter,
        '-q:v',
        '2', // High quality JPEG (1-31, lower = better)
        ...ffmpegOutputThreadArgs(),
        outputFile,
    ];
}

/** Parse a positive duration in seconds, or an `HH:MM:SS.fraction` timestamp; undefined when it is neither. */
export function parseDuration(value: string | undefined): number | undefined {
    if (!value) {
        return undefined;
    }
    const seconds = parseTimestampSeconds(value.trim()) ?? Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export function videoInputLocation(input: VideoInput): string {
    return input.kind === 'url' ? input.url : input.path;
}

/** ffprobe arguments that print the streams and container format of `input` as JSON. */
export function buildProbeArgs(input: VideoInput): string[] {
    return [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        ...videoInputOptions(input),
        videoInputLocation(input),
    ];
}

/**
 * Replace a signed URL in command output or arguments before they reach logs or failures. The command runners keep
 * bounded output whole lines at a time, so the URL is never cut in half.
 */
export function redactVideoInput(text: string, input: VideoInput): string {
    return input.kind === 'url' ? text.split(input.url).join(REDACTED_URL) : text;
}

/** Redact a signed URL from a command error in place, keeping its type and the flags `rethrowIfActivityStopped` reads. */
export function redactVideoInputError(error: unknown, input: VideoInput): unknown {
    if (input.kind !== 'url' || typeof error !== 'object' || error === null) {
        return error;
    }
    const fields = error as Record<string, unknown>;
    for (const key of ['message', 'stack', 'cmd', 'stdout', 'stderr']) {
        if (typeof fields[key] === 'string') {
            fields[key] = redactVideoInput(fields[key], input);
        }
    }
    // A spawn failure carries the full argv, including the URL.
    if (Array.isArray(fields.spawnargs)) {
        fields.spawnargs = fields.spawnargs.map((arg: unknown) =>
            typeof arg === 'string' ? redactVideoInput(arg, input) : arg,
        );
    }
    return error;
}

/**
 * Run ffmpeg or ffprobe with `args` that read `input`, keeping a signed URL out of the logged arguments, the returned
 * output and any error. `progress` runs it under the stall watchdog, for commands that print encoding progress, and
 * `completionBudget` also stops such a command early when it is not going to finish in time.
 */
export async function execOnVideoInput(
    input: VideoInput,
    command: 'ffmpeg' | 'ffprobe',
    args: string[],
    {
        progress = false,
        logMessage,
        completionBudget,
    }: { progress?: boolean; logMessage?: string; completionBudget?: CompletionBudget } = {},
): Promise<{ stdout: string; stderr: string }> {
    const redact = (text: string) => redactVideoInput(text, input);
    if (logMessage) {
        log.debug(logMessage, { command, args: args.map(redact) });
    }
    try {
        if (progress || completionBudget) {
            return await execActivityFileWithProgress(command, args, { redact, completionBudget });
        }
        const { stdout, stderr } = await execActivityFile(command, args);
        return { stdout: redact(stdout), stderr: redact(stderr) };
    } catch (error) {
        throw redactVideoInputError(error, input);
    }
}

/**
 * {@link rethrowIfActivityStopped} for a command on `input`. A command reading a URL that the stall watchdog killed is
 * not the activity stopping but a stalled connection, so it returns and the caller can fall back to the download.
 */
export function rethrowIfStoppedReading(error: unknown, input: VideoInput): void {
    if (input.kind === 'url' && isCommandStalled(error) && !Context.current().cancellationSignal.aborted) {
        return;
    }
    rethrowIfActivityStopped(error);
}

/**
 * Logger for a failed command on `input`. Over a URL the caller retries on a download, so the failure is a warning;
 * on a local file it is final.
 */
export function commandFailureLog(input: VideoInput): typeof log.warn {
    return input.kind === 'url' ? log.warn : log.error;
}

/**
 * Sign a GET URL for `source` so ffmpeg can read only the bytes it needs, valid for `ttlSeconds` when given and for the
 * store's default lifetime otherwise. Returns undefined when no HTTP(S) URL can be obtained, and the caller downloads
 * the file instead.
 */
export async function getSignedVideoUrl(
    client: VertesiaClient,
    source: string,
    ttlSeconds?: number,
): Promise<string | undefined> {
    try {
        // Same rule as `client.files.downloadFile`: an HTTPS source is already readable as is.
        const url = source.startsWith('https:')
            ? source
            : (await client.files.getDownloadUrl(source, undefined, undefined, ttlSeconds)).url;
        const { protocol } = new URL(url);
        if (protocol === 'https:' || protocol === 'http:') {
            return url;
        }
        log.warn('Signed URL for video source is not HTTP(S); downloading it instead', { source, protocol });
    } catch (error) {
        // A cancelled activity must not go on to download the source.
        rethrowIfActivityStopped(error);
        log.warn('Failed to sign a URL for video source; downloading it instead', {
            source,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return undefined;
}

/**
 * Age after which a signed URL is signed again before use. A URL signed without a lifetime can be valid for as little
 * as 15 minutes, so a command handed a URL at most this old has 10 minutes or more before it expires. A command that
 * outlives its URL fails with a 403, which is not retried, and falls back to the download. A command that reads its
 * whole source over the URL, such as a transcode, asks for a lifetime that covers the Activity instead
 * ({@link VideoSourceOptions.ttlSeconds}).
 */
const URL_REFRESH_MS = 5 * 60_000;

export interface VideoSourceOptions {
    /** Lifetime to sign the URL for, in seconds. The store's default when unset. */
    ttlSeconds?: number;
    /**
     * Called before the source is first downloaded, with the error of the URL read that failed, or undefined when there
     * is no URL or it produced no result. Throw to refuse the download, for example when it would not fit on disk.
     */
    beforeDownload?: (urlError: unknown) => void;
}

/**
 * A source video read over a signed URL where a command needs only part of the file, and downloaded once where a
 * command needs all of it, or where reading over the URL fails.
 *
 * Signed URLs are short-lived, so open the source right before the commands that use its URL.
 */
export class VideoSource {
    private download?: Promise<string>;
    private disposed = false;
    /** The current signed URL and when it was signed; unset once signing has failed. */
    private signed?: { url: string; at: number };
    /** A signing in progress, shared by every command that finds the URL too old. */
    private refresh?: Promise<void>;

    private constructor(
        private readonly client: VertesiaClient,
        private readonly source: string,
        url: string | undefined,
        private readonly options: VideoSourceOptions,
    ) {
        this.signed = url ? { url, at: Date.now() } : undefined;
    }

    static async open(client: VertesiaClient, source: string, options: VideoSourceOptions = {}): Promise<VideoSource> {
        return new VideoSource(client, source, await getSignedVideoUrl(client, source, options.ttlSeconds), options);
    }

    /**
     * Input for a command that reads part of the file: the local copy if there is one already, else the URL. A URL
     * older than {@link URL_REFRESH_MS} is signed again first, so every command starts with most of its lifetime left
     * however long the activity has run.
     */
    async partialInput(): Promise<VideoInput> {
        if (this.download || !this.signed) {
            return await this.localInput();
        }
        if (Date.now() - this.signed.at > URL_REFRESH_MS) {
            this.refresh ??= this.signAgain().finally(() => {
                this.refresh = undefined;
            });
            await this.refresh;
            if (!this.signed) {
                return await this.localInput();
            }
        }
        return { kind: 'url', url: this.signed.url };
    }

    private async signAgain(): Promise<void> {
        const url = await getSignedVideoUrl(this.client, this.source, this.options.ttlSeconds);
        this.signed = url ? { url, at: Date.now() } : undefined;
    }

    /**
     * Path of the downloaded file, for a command that reads all of it. Downloads on first use, once
     * {@link VideoSourceOptions.beforeDownload} allows it; `urlError` is the failed URL read that the download replaces.
     */
    async localPath(urlError?: unknown): Promise<string> {
        if (!this.download && this.disposed) {
            // A late fallback must not leave a download behind that nothing will remove.
            throw new Error('The video source was disposed before it was downloaded');
        }
        if (!this.download) {
            this.options.beforeDownload?.(urlError);
        }
        // A source over the media limit fails with a non-retryable SourceTooLargeError.
        const options = { maxBytes: getSourceLimits().mediaMaxBytes, limit: 'media' };
        this.download ??= saveBlobToTempFile(this.client, this.source, undefined, options).catch((error: unknown) => {
            // An HTTPS source is itself a signed URL, and a failed download quotes its source in the error.
            throw this.source.startsWith('https:')
                ? redactVideoInputError(error, { kind: 'url', url: this.source })
                : error;
        });
        return await this.download;
    }

    /** {@link localPath} as a command input. */
    async localInput(urlError?: unknown): Promise<VideoInput> {
        return { kind: 'file', path: await this.localPath(urlError) };
    }

    /**
     * Run `command` on {@link partialInput}. When it reads the URL and fails or returns nothing, run it again on the
     * downloaded file. A URL probe can omit duration or streams when the server cannot seek, so confirm unusable
     * content on the local copy too. Cancellation is never retried; a URL read stopped for making no progress is.
     */
    async withFallback<T>(command: (input: VideoInput) => Promise<T>): Promise<T> {
        const input = await this.partialInput();
        if (input.kind === 'file') {
            return await command(input);
        }
        let urlError: unknown;
        try {
            const result = await command(input);
            if (result !== undefined) {
                return result;
            }
            log.warn('Reading the video over its signed URL produced no result; downloading it instead');
        } catch (error) {
            rethrowIfStoppedReading(error, input);
            log.warn('Reading the video over its signed URL failed; downloading it instead', {
                error: error instanceof Error ? error.message : String(error),
            });
            urlError = error;
        }
        return await command(await this.localInput(urlError));
    }

    /** Remove the downloaded copy, if any. */
    async dispose(): Promise<void> {
        this.disposed = true;
        const download = this.download;
        if (!download) {
            return;
        }
        const file = await download.catch(() => undefined);
        if (!file) {
            return;
        }
        await removeTempFiles(file);
    }
}

/**
 * Like `Promise.all`, but rejects only after every operation has settled, so the caller can clean up files and
 * downloads that a still-running sibling would otherwise use or create. Rejects with the first failure.
 */
export async function allSettledOrThrow<T>(operations: Promise<T>[]): Promise<T[]> {
    const results = await Promise.allSettled(operations);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) {
        throw failed.reason;
    }
    return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}
