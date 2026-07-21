import { type ExecFileOptions, execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Context } from '@temporalio/activity';

const execFileAsync = promisify(execFileCallback);

/** 10MB buffer for ffmpeg output. */
export const FFMPEG_MAX_BUFFER = 1024 * 1024 * 10;

const MAX_COMMAND_TIMEOUT_MARGIN_MS = 60_000;

/** Terminate an ffmpeg child that makes no encoding progress for this long, so Temporal can retry it promptly. */
const FFMPEG_STALL_TIMEOUT_MS = 120_000;

// ffmpeg streams encoding progress as `frame=`/`time=` stats. We track the *advance* of these monotonic fields (rather
// than mere presence) so a wedged encoder that keeps re-emitting an identical status line is still detected as stalled.
const FFMPEG_TIME_PATTERN = /time=\s*(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)/;
const FFMPEG_FRAME_PATTERN = /frame=\s*(\d+)/;
// ffmpeg delimits stats snapshots with a carriage return, so the carry buffer normally stays tiny. These bounds are a
// defensive guard against an unterminated stream, retaining enough of a tail to reunite a marker split at the boundary.
const PROGRESS_CARRY_LIMIT = 64 * 1024;
const PROGRESS_CARRY_TAIL = 512;

const activityCommandDeadlines = new WeakMap<Context, number>();

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

    return (await execFileAsync(command, args, {
        ...options,
        encoding: 'utf8',
        signal: Context.current().cancellationSignal,
        timeout: Math.min(configuredTimeoutMs, activityTimeoutMs),
    })) as { stdout: string; stderr: string };
}

export interface ProgressAwareOptions {
    maxBuffer?: number;
    stallTimeoutMs?: number;
}

function parseFfmpegTimeCentis(text: string): number | undefined {
    const match = FFMPEG_TIME_PATTERN.exec(text);
    if (!match) {
        return undefined;
    }
    const totalSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Number.isFinite(totalSeconds) ? Math.round(totalSeconds * 100) : undefined;
}

function parseFfmpegFrame(text: string): number | undefined {
    const match = FFMPEG_FRAME_PATTERN.exec(text);
    return match ? Number(match[1]) : undefined;
}

export interface ProgressTracker {
    /** Feed a raw output chunk; returns true when a monotonic progress field advanced past its previous maximum. */
    observe(chunk: string): boolean;
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
    };
}

/**
 * Execute a long-running media command while enforcing a progress-stall watchdog on top of the Activity deadline and
 * cancellation.
 *
 * The worker heartbeats every Activity on a fixed interval, so a wedged ffmpeg child that stops emitting progress would
 * otherwise keep the Activity alive until its multi-hour Start-to-Close timeout. Watching ffmpeg's progress markers lets
 * us terminate a stalled encode within `stallTimeoutMs` so Temporal retries it promptly (escalating to a faster preset
 * on the next attempt). A stall is surfaced as a `killed` error so it propagates as an Activity failure via
 * {@link rethrowIfActivityStopped} instead of being swallowed into a missing rendition.
 */
export async function execActivityFileWithProgress(
    command: string,
    args: string[],
    { maxBuffer = FFMPEG_MAX_BUFFER, stallTimeoutMs = FFMPEG_STALL_TIMEOUT_MS }: ProgressAwareOptions = {},
): Promise<{ stdout: string; stderr: string }> {
    const activityTimeoutMs = getActivityCommandTimeoutMs();
    const stallWindowMs = Math.max(1, Math.min(stallTimeoutMs, activityTimeoutMs));

    return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(command, args, {
            signal: Context.current().cancellationSignal,
            timeout: activityTimeoutMs,
            killSignal: 'SIGKILL',
        });

        let stdout = '';
        let stderr = '';
        let settled = false;
        let stalled = false;
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
            return combined.length > maxBuffer ? combined.slice(combined.length - maxBuffer) : combined;
        };

        // ffmpeg writes progress to stderr by default, but track both streams so the watchdog works regardless of where
        // a given command reports it. Each stream keeps its own line buffer.
        const stdoutProgress = createFfmpegProgressTracker();
        const stderrProgress = createFfmpegProgressTracker();

        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (chunk: string) => {
            stdout = append(stdout, chunk);
            if (stdoutProgress.observe(chunk)) {
                armStallTimer();
            }
        });
        child.stderr?.on('data', (chunk: string) => {
            stderr = append(stderr, chunk);
            if (stderrProgress.observe(chunk)) {
                armStallTimer();
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
            finish();
        };

        child.on('error', (error) => settle(() => reject(error)));

        child.on('close', (code, signal) =>
            settle(() => {
                if (stalled) {
                    const seconds = Math.round(stallWindowMs / 1000);
                    reject(
                        Object.assign(new Error(`${command} made no progress for ${seconds}s and was terminated`), {
                            killed: true,
                            stalled: true,
                        }),
                    );
                } else if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    const detail = signal ? `signal ${signal}` : `code ${code}`;
                    reject(
                        Object.assign(new Error(`${command} exited with ${detail}: ${stderr.slice(-2000)}`), {
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

/**
 * Re-throw errors that represent the Activity being stopped (cancellation, Start-to-Close timeout, or a progress-stall
 * kill) so they are not swallowed by rendition fallback handling. Genuine tool failures still return `null` upstream.
 */
export function rethrowIfActivityStopped(error: unknown): void {
    const commandTimedOut = typeof error === 'object' && error !== null && 'killed' in error && error.killed === true;
    if (Context.current().cancellationSignal.aborted || commandTimedOut) {
        throw error;
    }
}
