import { type ChildProcess, type ExecFileOptions, execFile as execFileCallback, spawn } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { ApplicationFailure, Context } from '@temporalio/activity';

const execFileAsync = promisify(execFileCallback);

/** 10MB buffer for ffmpeg output. */
export const FFMPEG_MAX_BUFFER = 1024 * 1024 * 10;

const MAX_COMMAND_TIMEOUT_MARGIN_MS = 60_000;

/** How long a stopped child gets to exit after its kill signal before it is killed outright. */
const CHILD_EXIT_GRACE_MS = 5_000;

/** Terminate an ffmpeg child that makes no encoding progress for this long, so Temporal can retry it promptly. */
const FFMPEG_STALL_TIMEOUT_MS = 120_000;

// ffmpeg streams encoding progress as `frame=`/`time=` stats. We track the *advance* of these monotonic fields (rather
// than mere presence) so a wedged encoder that keeps re-emitting an identical status line is still detected as stalled.
// `H:MM:SS[.fraction]`, as ffmpeg prints `time=` and Matroska stores a stream's DURATION tag.
const TIMESTAMP_SOURCE = String.raw`(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)`;
const TIMESTAMP_PATTERN = new RegExp(`^${TIMESTAMP_SOURCE}$`);
const FFMPEG_TIME_PATTERN = new RegExp(`time=\\s*${TIMESTAMP_SOURCE}`);
const FFMPEG_FRAME_PATTERN = /frame=\s*(\d+)/;
// ffmpeg delimits stats snapshots with a carriage return, so the carry buffer normally stays tiny. These bounds are a
// defensive guard against an unterminated stream, retaining enough of a tail to reunite a marker split at the boundary.
const PROGRESS_CARRY_LIMIT = 64 * 1024;
const PROGRESS_CARRY_TAIL = 512;

/**
 * CPUs ffmpeg may actually use. Left to itself, ffmpeg (and libx264) sizes its thread pools from the process's CPU
 * affinity mask, which in a container is usually the host's CPUs rather than the container's CPU limit, so a small
 * container on a large host starts far more threads than it has CPU time for. `os.availableParallelism()` also honours
 * the cgroup CPU limit.
 */
export function ffmpegThreadCount(): number {
    return Math.max(1, os.availableParallelism());
}

/** Options placed before `-i`: size the input decoder and the filter graph to the available CPUs. */
export function ffmpegInputThreadArgs(): string[] {
    const threads = String(ffmpegThreadCount());
    return ['-filter_threads', threads, '-threads', threads];
}

/** Options placed before the output file: size the output encoder to the available CPUs. */
export function ffmpegOutputThreadArgs(): string[] {
    return ['-threads', String(ffmpegThreadCount())];
}

/**
 * libx264 encoder threads. Keeps x264's own automatic rule (1.5 threads per CPU, so frame threads waiting on a
 * reference frame do not leave a CPU idle) but applies it to the available CPUs instead of the affinity mask.
 */
export function libx264ThreadArgs(): string[] {
    return ['-threads', String(Math.floor((ffmpegThreadCount() * 3) / 2))];
}

const activityCommandDeadlines = new WeakMap<Context, number>();

/** Characters of stderr quoted in a command error. */
const ERROR_STDERR_CHARS = 2000;

/**
 * The last `maxChars` of `text`, starting at a line boundary so no line is cut in half. Redaction then sees whole
 * lines: a secret printed on one line is either kept whole or dropped. Falls back to a plain cut for one huge line.
 */
export function keepTailLines(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }
    const tail = text.slice(text.length - maxChars);
    const lineStart = tail.search(/[\r\n]/);
    return lineStart >= 0 ? tail.slice(lineStart + 1) : tail;
}

/**
 * Anchor the child-process deadline at the moment the Activity starts, so every later command derives its timeout from a
 * stable point regardless of how long input download took.
 */
export function initializeActivityCommandDeadline(): number {
    const context = Context.current();
    const existingDeadlineMs = activityCommandDeadlines.get(context);
    if (existingDeadlineMs) {
        return existingDeadlineMs;
    }
    const deadlineMs = Date.now() + context.info.startToCloseTimeoutMs;
    activityCommandDeadlines.set(context, deadlineMs);
    return deadlineMs;
}

function getActivityCommandTimeoutMs(): number {
    const context = Context.current();
    const { startToCloseTimeoutMs } = context.info;
    const timeoutMarginMs = Math.min(MAX_COMMAND_TIMEOUT_MARGIN_MS, startToCloseTimeoutMs / 10);
    const activityDeadlineMs = initializeActivityCommandDeadline();
    return Math.max(1, activityDeadlineMs - Date.now() - timeoutMarginMs);
}

/**
 * Execute media tooling with Temporal cancellation propagated to the child process.
 *
 * Temporal can begin a retry after an attempt times out while the original worker process is still running. Passing the
 * Activity cancellation signal prevents an orphaned ffmpeg process from competing with its retry for CPU.
 */
export async function execActivityFile(
    command: string,
    args: string[],
    options: ExecFileOptions = {},
): Promise<{ stdout: string; stderr: string }> {
    const activityTimeoutMs = getActivityCommandTimeoutMs();
    const configuredTimeoutMs = options.timeout && options.timeout > 0 ? options.timeout : activityTimeoutMs;

    const execution = execFileAsync(command, args, {
        ...options,
        encoding: 'utf8',
        signal: Context.current().cancellationSignal,
        timeout: Math.min(configuredTimeoutMs, activityTimeoutMs),
    });
    try {
        return (await execution) as { stdout: string; stderr: string };
    } catch (err: unknown) {
        // On cancellation execFile rejects as soon as it signals the child, not once the child has exited. Wait for it,
        // so a caller removing the child's files cannot race a child that is still writing them.
        await waitForChildExit(execution.child);
        throw err;
    }
}

/** Wait for a signalled child to exit, killing it outright if it outlives the grace period. */
async function waitForChildExit(child: ChildProcess): Promise<void> {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    await new Promise<void>((resolve) => {
        const forceKill = setTimeout(() => child.kill('SIGKILL'), CHILD_EXIT_GRACE_MS);
        // A child that does not report its exit even after SIGKILL must not block the caller forever.
        const giveUp = setTimeout(done, 2 * CHILD_EXIT_GRACE_MS);
        function done() {
            clearTimeout(forceKill);
            clearTimeout(giveUp);
            child.off('exit', done);
            resolve();
        }
        child.once('exit', done);
    });
}

export interface ProgressAwareOptions {
    /**
     * Coarse upper bound on retained stdout/stderr, counted in UTF-16 code units (not UTF-8 bytes). ffmpeg output is
     * ASCII-dominant so this closely tracks bytes; it only exists to keep captured output from growing without bound
     * (older output is dropped — tail retained — rather than failing the command). Not a strict byte cap.
     */
    maxBuffer?: number;
    stallTimeoutMs?: number;
    /**
     * Applied to the retained stdout and stderr before they are returned or quoted in an error. Output is retained whole
     * lines at a time, so a secret printed on one line is never cut in half before this sees it.
     */
    redact?: (text: string) => string;
    /**
     * Stop the command early, without retrying, when it is not going to finish in time: once `judgeAfterMs` has
     * passed, its finish time is projected from how much of `mediaDurationSeconds` ffmpeg has processed, and if that
     * exceeds `budgetMs` (counted from the command's start) it is killed and fails with
     * {@link TRANSCODE_EXCEEDS_TIME_BUDGET}.
     */
    completionBudget?: CompletionBudget;
}

export interface CompletionBudget {
    mediaDurationSeconds: number;
    budgetMs: number;
    /** How long to let the command run before judging its speed. Default 3 minutes. */
    judgeAfterMs?: number;
}

const DEFAULT_COMPLETION_JUDGE_AFTER_MS = 3 * 60_000;

/** Failure `type` of a transcode that would not finish within its time budget. Never retried. */
export const TRANSCODE_EXCEEDS_TIME_BUDGET = 'TranscodeExceedsTimeBudget';

/** Whether a failure is the {@link TRANSCODE_EXCEEDS_TIME_BUDGET} of a transcode that would not finish in time. */
export function isTranscodeExceedsTimeBudget(error: unknown): error is ApplicationFailure {
    return error instanceof ApplicationFailure && error.type === TRANSCODE_EXCEEDS_TIME_BUDGET;
}

/**
 * The projected total run time of a command that has run `elapsedMs` and processed `processedSeconds` of
 * `mediaDurationSeconds`, or undefined before any progress.
 */
export function projectCompletionMs(
    elapsedMs: number,
    processedSeconds: number,
    mediaDurationSeconds: number,
): number | undefined {
    if (processedSeconds <= 0 || mediaDurationSeconds <= 0) {
        return undefined;
    }
    return (elapsedMs * mediaDurationSeconds) / Math.min(processedSeconds, mediaDurationSeconds);
}

function timestampSeconds(match: RegExpExecArray): number {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Seconds in an `H:MM:SS[.fraction]` timestamp, or undefined when `text` is not one. */
export function parseTimestampSeconds(text: string): number | undefined {
    const match = TIMESTAMP_PATTERN.exec(text);
    return match ? timestampSeconds(match) : undefined;
}

function parseFfmpegTimeCentis(text: string): number | undefined {
    const match = FFMPEG_TIME_PATTERN.exec(text);
    if (!match) {
        return undefined;
    }
    const totalSeconds = timestampSeconds(match);
    return Number.isFinite(totalSeconds) ? Math.round(totalSeconds * 100) : undefined;
}

function parseFfmpegFrame(text: string): number | undefined {
    const match = FFMPEG_FRAME_PATTERN.exec(text);
    return match ? Number(match[1]) : undefined;
}

export interface ProgressTracker {
    /** Feed a raw output chunk; returns true when a monotonic progress field advanced past its previous maximum. */
    observe(chunk: string): boolean;
    /** Media seconds processed so far, from the furthest `time=` seen; 0 before any. */
    mediaSeconds(): number;
}

/**
 * Track ffmpeg forward progress across arbitrarily-chunked output.
 *
 * Node delivers stream data in arbitrary slices, so a marker such as `frame=42` can arrive split across two chunks. The
 * tracker buffers partial records until a `\r`/`\n` delimiter completes them, then reports advancement only when the
 * parsed frame count or media timestamp exceeds the previous maximum — repeated identical stats from a wedged encoder do
 * not count as progress.
 */
export function createFfmpegProgressTracker(): ProgressTracker {
    let carry = '';
    let maxTimeCentis = -1;
    let maxFrame = -1;

    const noteSegment = (segment: string): boolean => {
        let advanced = false;
        const timeCentis = parseFfmpegTimeCentis(segment);
        if (timeCentis !== undefined && timeCentis > maxTimeCentis) {
            maxTimeCentis = timeCentis;
            advanced = true;
        }
        const frame = parseFfmpegFrame(segment);
        if (frame !== undefined && frame > maxFrame) {
            maxFrame = frame;
            advanced = true;
        }
        return advanced;
    };

    return {
        observe(chunk: string): boolean {
            carry += chunk;
            const segments = carry.split(/[\r\n]+/);
            carry = segments.pop() ?? '';
            let advanced = false;
            for (const segment of segments) {
                advanced = noteSegment(segment) || advanced;
            }
            if (carry.length > PROGRESS_CARRY_LIMIT) {
                advanced = noteSegment(carry) || advanced;
                carry = carry.slice(carry.length - PROGRESS_CARRY_TAIL);
            }
            return advanced;
        },
        mediaSeconds(): number {
            return maxTimeCentis > 0 ? maxTimeCentis / 100 : 0;
        },
    };
}

/**
 * Execute a long-running media command while enforcing a progress-stall watchdog on top of the Activity deadline and
 * cancellation.
 *
 * The worker heartbeats every Activity on a fixed interval, so a wedged ffmpeg child that stops emitting progress would
 * otherwise keep the Activity alive until its multi-hour Start-to-Close timeout. Watching ffmpeg's progress markers lets
 * us terminate a stalled encode within `stallTimeoutMs` so Temporal retries it promptly. A stall is surfaced as a
 * `killed` error so it propagates as an Activity failure via {@link rethrowIfActivityStopped} instead of being
 * swallowed into a missing rendition. A child still running at the Activity's deadline is killed the same way, and its
 * error is marked so callers can tell it apart ({@link isActivityDeadlineExceeded}).
 */
export async function execActivityFileWithProgress(
    command: string,
    args: string[],
    {
        maxBuffer = FFMPEG_MAX_BUFFER,
        stallTimeoutMs = FFMPEG_STALL_TIMEOUT_MS,
        completionBudget,
        redact = (text) => text,
    }: ProgressAwareOptions = {},
): Promise<{ stdout: string; stderr: string }> {
    const activityTimeoutMs = getActivityCommandTimeoutMs();
    const stallWindowMs = Math.max(1, Math.min(stallTimeoutMs, activityTimeoutMs));

    return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, {
            signal: Context.current().cancellationSignal,
            killSignal: 'SIGKILL',
        });
        // The Activity deadline, kept here rather than as spawn's `timeout` so its kill is distinguishable from a stall.
        let deadlineExceeded = false;
        const deadlineTimer = setTimeout(() => {
            deadlineExceeded = true;
            child.kill('SIGKILL');
        }, activityTimeoutMs);
        deadlineTimer.unref?.();

        let stdout = '';
        let stderr = '';
        let settled = false;
        let stalled = false;
        let overBudget: { projectedMs: number; elapsedMs: number } | undefined;
        const startedAt = Date.now();
        let stallTimer: NodeJS.Timeout | undefined;

        const armStallTimer = () => {
            if (stallTimer) {
                clearTimeout(stallTimer);
            }
            stallTimer = setTimeout(() => {
                stalled = true;
                child.kill('SIGKILL');
            }, stallWindowMs);
            // Never keep the event loop alive solely for the watchdog timer.
            stallTimer.unref?.();
        };

        const append = (current: string, chunk: string): string => {
            const combined = current + chunk;
            return keepTailLines(combined, maxBuffer);
        };

        // ffmpeg writes progress to stderr by default, but track both streams so the watchdog works regardless of where
        // a given command reports it. Each stream keeps its own line buffer.
        const stdoutProgress = createFfmpegProgressTracker();
        const stderrProgress = createFfmpegProgressTracker();

        const checkCompletionBudget = (progress: ProgressTracker) => {
            if (!completionBudget || overBudget) {
                return;
            }
            const elapsedMs = Date.now() - startedAt;
            if (elapsedMs < (completionBudget.judgeAfterMs ?? DEFAULT_COMPLETION_JUDGE_AFTER_MS)) {
                return;
            }
            const projectedMs = projectCompletionMs(
                elapsedMs,
                progress.mediaSeconds(),
                completionBudget.mediaDurationSeconds,
            );
            if (projectedMs !== undefined && projectedMs > completionBudget.budgetMs) {
                overBudget = { projectedMs, elapsedMs };
                child.kill('SIGKILL');
            }
        };

        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (chunk: string) => {
            stdout = append(stdout, chunk);
            if (stdoutProgress.observe(chunk)) {
                armStallTimer();
                checkCompletionBudget(stdoutProgress);
            }
        });
        child.stderr?.on('data', (chunk: string) => {
            stderr = append(stderr, chunk);
            if (stderrProgress.observe(chunk)) {
                armStallTimer();
                checkCompletionBudget(stderrProgress);
            }
        });

        armStallTimer();

        const settle = (finish: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            if (stallTimer) {
                clearTimeout(stallTimer);
            }
            clearTimeout(deadlineTimer);
            finish();
        };

        child.on('error', (error) => settle(() => reject(error)));

        child.on('close', (code, signal) =>
            settle(() => {
                if (overBudget) {
                    const minutes = (ms: number) => Math.round(ms / 60_000);
                    reject(
                        ApplicationFailure.create({
                            type: TRANSCODE_EXCEEDS_TIME_BUDGET,
                            nonRetryable: true,
                            message:
                                `${command} was projected to take ${minutes(overBudget.projectedMs)} min after ` +
                                `${minutes(overBudget.elapsedMs)} min, more than its ` +
                                `${minutes(completionBudget?.budgetMs ?? 0)} min budget, and was stopped`,
                        }),
                    );
                } else if (deadlineExceeded) {
                    const seconds = Math.round(activityTimeoutMs / 1000);
                    reject(
                        Object.assign(new Error(`${command} was still running at the ${seconds}s Activity deadline`), {
                            killed: true,
                            deadlineExceeded: true,
                        }),
                    );
                } else if (stalled) {
                    const seconds = Math.round(stallWindowMs / 1000);
                    reject(
                        Object.assign(new Error(`${command} made no progress for ${seconds}s and was terminated`), {
                            killed: true,
                            stalled: true,
                        }),
                    );
                } else if (code === 0) {
                    resolve({ stdout: redact(stdout), stderr: redact(stderr) });
                } else {
                    const detail = signal ? `signal ${signal}` : `code ${code}`;
                    // Redact a line-aligned window, not the whole buffer, then quote its tail.
                    const quoted = redact(keepTailLines(stderr, 16 * ERROR_STDERR_CHARS)).slice(-ERROR_STDERR_CHARS);
                    reject(
                        Object.assign(new Error(`${command} exited with ${detail}: ${quoted}`), {
                            killed: child.killed || signal != null,
                            code,
                            signal,
                        }),
                    );
                }
            }),
        );
    });
}

/** Whether a command was killed for running into its Activity's deadline (not a stall, a budget stop or cancellation). */
export function isActivityDeadlineExceeded(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'deadlineExceeded' in error && error.deadlineExceeded === true
    );
}

/** Whether a command was killed by the progress-stall watchdog of {@link execActivityFileWithProgress}. */
export function isCommandStalled(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'stalled' in error && error.stalled === true;
}

/** Failure `type` of a file without a usable video stream: a property of the content, logged at warn. */
export const UNUSABLE_VIDEO_CONTENT = 'UnusableVideoContent';

/** Whether a failure is the {@link UNUSABLE_VIDEO_CONTENT} raised by a metadata probe, which already logged it. */
export function isUnusableVideoContent(error: unknown): error is ApplicationFailure {
    return error instanceof ApplicationFailure && error.type === UNUSABLE_VIDEO_CONTENT;
}

/**
 * Re-throw errors that represent the Activity being stopped (cancellation, Start-to-Close timeout, or a progress-stall
 * kill) so they are not swallowed by rendition fallback handling. Genuine tool failures still return `null` upstream.
 */
export function rethrowIfActivityStopped(error: unknown): void {
    const commandTimedOut = typeof error === 'object' && error !== null && 'killed' in error && error.killed === true;
    if (Context.current().cancellationSignal.aborted || commandTimedOut || isTranscodeExceedsTimeBudget(error)) {
        throw error;
    }
}
