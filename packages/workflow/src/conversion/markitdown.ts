import { log } from '@temporalio/activity';
import { activityCommandWindow } from '../activities/media/exec.js';
import { DocumentConversionError, SourceTooLargeError } from '../errors.js';
import {
    allowUnlimitedOfficeMemory,
    getOfficeMaxConcurrent,
    getSourceLimits,
    logSourceLimitExceeded,
    OFFICE_ALLOW_UNLIMITED_MEMORY_ENV,
} from '../utils/source-limits.js';
import { type ConvertOptions, convertWithTool } from './convert-with-tool.js';
import { InvalidZipError, readZipEntries, type ZipEntry } from './office-zip.js';
import { findPrlimit, limiterSupported } from './prlimit.js';

/** The formats extractDocumentText converts with markitdown. */
export type MarkitdownFormat = 'docx' | 'pptx';

export interface MarkitdownOptions extends Pick<ConvertOptions, 'maxOutputBytes'> {
    /** Where the file was downloaded from, named in logs and errors instead of its temporary path. */
    source?: string;
}

/**
 * markitdown's own exceptions. Its command-line tool does not catch them, so they end the process with exit code 1
 * and a traceback on stderr.
 */
const MARKITDOWN_EXCEPTION = /\b(FileConversionException|UnsupportedFormatException)\b/;

/**
 * Errors a converter raises on a malformed document, which fail the same way at every attempt. markitdown wraps
 * whatever a converter raises in a FileConversionException, `MemoryError` and `OSError` included, so only these
 * causes make the failure permanent; any other cause lets a retry run.
 */
const INPUT_ERRORS = new Set(['BadZipFile', 'XMLSyntaxError', 'PackageNotFoundError']);

/** A converter's failure as markitdown 0.1 lists it: ` - DocxConverter threw BadZipFile with message: ...`. */
const FAILED_ATTEMPT = /\bthrew ([\w.]+) with message:/;

/** The exception line Python prints last: `zipfile.BadZipFile: File is not a zip file`, or `MemoryError` alone. */
const EXCEPTION_LINE = /^([\w.]+)(?::|$)/;

/** Characters of markitdown's error quoted in a {@link DocumentConversionError}. */
const MAX_REASON_CHARS = 1000;

/**
 * The only variables markitdown is given. It parses untrusted documents, so it does not get the worker's credentials;
 * these are what Python needs to find its tools, a temporary directory and a locale.
 */
const ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];

/**
 * Set for markitdown whatever the worker's environment. glibc's allocator otherwise reserves an arena per core, and
 * onnxruntime (the file-type model markitdown loads) a thread per core, so the address space markitdown starts with
 * would grow with the machine and eat into its memory limit: 0.5 GiB with these, 1.2 GiB without them on 8 cores.
 */
const FIXED_ENV = { MALLOC_ARENA_MAX: '2', OMP_NUM_THREADS: '1' };

/**
 * The zip compression methods Office writes: stored and deflate. Python's zipfile bounds a deflate entry to its
 * declared size as it decompresses, but decompresses a bzip2 or LZMA block whole before cutting it to that size, so
 * the declared sizes the preflight trusts would not bound memory for those.
 */
const OFFICE_COMPRESSION_METHODS = new Set([0, 8]);

/** Parts of a PPTX that python-pptx parses as XML; it also loads every other part, as bytes of about their own size. */
const PPTX_PARSED_PART = /\.(?:xml|rels)$/i;

/**
 * Convert a DOCX or PPTX file to Markdown with markitdown.
 *
 * The document is checked before it is converted: markitdown holds all of it in memory, the parts it parses several
 * times over, and a small zip can decompress to gigabytes. A document over the `officeMaxParsedBytes` or the
 * `officeMaxUnpackedBytes` limit of {@link getSourceLimits}, or compressed by a method Office does not use, is
 * refused. On Linux, markitdown then runs under the `officeMaxMemoryBytes` address-space limit, whatever the
 * document's structure; one worker process runs {@link getOfficeMaxConcurrent} conversions at a time. A conversion
 * waiting for its turn stops waiting when the Activity is cancelled or reaches its deadline.
 *
 * @param file path of the document; markitdown picks its converter from the extension, so it must end with `.docx`
 *   or `.pptx`
 * @param format the document's format
 * @throws SourceTooLargeError when the document decompresses to more than markitdown may parse, or markitdown runs out
 *   of its memory limit converting it
 * @throws DocumentConversionError when the file is not a valid document of its format; it is not retried
 * @throws Error when this Linux system has no `prlimit` and the unlimited opt-out is not set: a worker configuration
 *   error
 */
export async function markdownWithMarkitdown(
    file: string,
    format: MarkitdownFormat,
    options: MarkitdownOptions = {},
): Promise<string> {
    const source = options.source ?? file;
    const prlimit = memoryLimiter();
    await checkSize(file, format, source);
    const maxMemoryBytes = getSourceLimits().officeMaxMemoryBytes;
    const release = await acquireConversionSlot(activityCommandWindow());
    try {
        return await convertWithTool(
            prlimit ?? 'markitdown',
            file,
            undefined,
            'md',
            (inputFile, outputFile) => {
                const command = ['markitdown', inputFile, '-o', outputFile];
                return prlimit === undefined ? command.slice(1) : [`--as=${maxMemoryBytes}`, ...command];
            },
            {
                maxOutputBytes: options.maxOutputBytes,
                env: markitdownEnv(),
            },
        );
    } catch (err: unknown) {
        if (prlimit !== undefined && ranOutOfMemory(err)) {
            // Under its own limit a MemoryError is the document's doing, and would recur at every attempt.
            logSourceLimitExceeded({ source, limit: 'office_memory', max_bytes: maxMemoryBytes, outcome: 'rejected' });
            throw new SourceTooLargeError(source, maxMemoryBytes);
        }
        const reason = rejectionReason(err);
        if (reason === undefined) {
            // A crash, a kill or a timeout: a retry may succeed.
            throw err;
        }
        throw new DocumentConversionError(
            `markitdown cannot convert the ${format.toUpperCase()} ${source}: ${reason}`,
            err instanceof Error ? err : undefined,
        );
    } finally {
        release();
    }
}

let warnedNoLimiter = false;

/**
 * The `prlimit` that enforces markitdown's memory limit, or undefined where markitdown runs without one: a system
 * that cannot enforce it (not Linux), or a Linux system without `prlimit` whose operator opted out.
 *
 * @throws Error on Linux without `prlimit`, unless {@link OFFICE_ALLOW_UNLIMITED_MEMORY_ENV} is set
 */
function memoryLimiter(): string | undefined {
    const prlimit = findPrlimit();
    if (prlimit !== undefined) {
        return prlimit;
    }
    if (limiterSupported() && !allowUnlimitedOfficeMemory()) {
        throw new Error(
            'markitdown needs prlimit (util-linux) on the PATH to limit its memory, and this worker has none. ' +
                `Install it, or set ${OFFICE_ALLOW_UNLIMITED_MEMORY_ENV}=true for local development only.`,
        );
    }
    if (!warnedNoLimiter) {
        warnedNoLimiter = true;
        log.warn('markitdown runs without a memory limit', { platform: process.platform });
    }
    return undefined;
}

let runningConversions = 0;
const waitingConversions: (() => void)[] = [];

/**
 * Wait for a conversion slot of this process, and return the function that frees it. A freed slot passes straight to
 * the next waiter, so a caller arriving meanwhile cannot take it too. A waiter leaves the queue as soon as `signal`
 * aborts or `timeoutMs` passes, and the promise rejects, so its caller can release what it holds.
 */
async function acquireConversionSlot({
    signal,
    timeoutMs,
}: {
    signal: AbortSignal;
    timeoutMs: number;
}): Promise<() => void> {
    signal.throwIfAborted();
    if (runningConversions < getOfficeMaxConcurrent()) {
        runningConversions++;
    } else {
        log.info('Waiting for another markitdown conversion to finish', { running: runningConversions });
        await new Promise<void>((resolve, reject) => {
            const leave = (err: unknown) => {
                const index = waitingConversions.indexOf(take);
                if (index >= 0) {
                    waitingConversions.splice(index, 1);
                }
                stop();
                reject(err);
            };
            const onAbort = () => leave(signal.reason);
            const timer = setTimeout(
                () => leave(new Error(`No markitdown conversion slot was free within ${timeoutMs} ms`)),
                timeoutMs,
            );
            const stop = () => {
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
            };
            const take = () => {
                stop();
                resolve();
            };
            signal.addEventListener('abort', onAbort, { once: true });
            waitingConversions.push(take);
        });
    }
    let released = false;
    return () => {
        if (released) {
            return;
        }
        released = true;
        const next = waitingConversions.shift();
        if (next) {
            next();
        } else {
            runningConversions--;
        }
    };
}

/** Decompressed sizes of a document's parts: those markitdown parses, and all of them. */
export interface OfficeSize {
    parsed: number;
    unpacked: number;
}

export function officeSize(format: MarkitdownFormat, entries: ZipEntry[]): OfficeSize {
    let parsed = 0;
    let unpacked = 0;
    for (const entry of entries) {
        unpacked += entry.uncompressedSize;
        // mammoth also turns every DOCX image into a base64 data URI, which costs as much memory as XML does.
        if (format === 'docx' || PPTX_PARSED_PART.test(entry.name)) {
            parsed += entry.uncompressedSize;
        }
    }
    return { parsed, unpacked };
}

async function checkSize(file: string, format: MarkitdownFormat, source: string): Promise<void> {
    let entries: ZipEntry[];
    try {
        entries = await readZipEntries(file);
    } catch (err: unknown) {
        if (err instanceof InvalidZipError) {
            // Not a zip, so not an Office document: markitdown would fail on it the same way at every attempt.
            throw new DocumentConversionError(
                `${source} is not a valid ${format.toUpperCase()} file: ${err.message}`,
                err,
            );
        }
        throw err;
    }
    const method = entries.find((entry) => !OFFICE_COMPRESSION_METHODS.has(entry.compressionMethod));
    if (method !== undefined) {
        throw new DocumentConversionError(
            `${source} is not a valid ${format.toUpperCase()} file: ${method.name} uses zip compression method ` +
                `${method.compressionMethod}, which Office does not write`,
        );
    }
    const size = officeSize(format, entries);
    const limits = getSourceLimits();
    const checks = [
        { limit: 'office_parsed', size: size.parsed, maxBytes: limits.officeMaxParsedBytes },
        { limit: 'office_unpacked', size: size.unpacked, maxBytes: limits.officeMaxUnpackedBytes },
    ];
    for (const { limit, size, maxBytes } of checks) {
        if (size > maxBytes) {
            logSourceLimitExceeded({ source, limit, max_bytes: maxBytes, size, outcome: 'rejected' });
            throw new SourceTooLargeError(source, maxBytes, size);
        }
    }
}

function markitdownEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...FIXED_ENV };
    for (const name of ENV_ALLOWLIST) {
        const value = process.env[name];
        if (value !== undefined) {
            env[name] = value;
        }
    }
    return env;
}

/**
 * Why markitdown rejected the document, when it failed in a way no retry can change: it has no converter for the
 * format, or every converter it tried raised one of {@link INPUT_ERRORS}. The reason is the line that names
 * markitdown's exception and the last line of stderr, which states the underlying error (such as
 * `BadZipFile: File is not a zip file`). Undefined for any other failure.
 */
export function rejectionReason(err: unknown): string | undefined {
    const lines = stderrLines(err);
    if (lines === undefined) {
        return undefined;
    }
    // The raised exception is printed after the traceback lines that also name it, so take the last mention.
    const exceptionLine = lines.findLast((line) => MARKITDOWN_EXCEPTION.test(line));
    if (exceptionLine === undefined) {
        return undefined;
    }
    if (MARKITDOWN_EXCEPTION.exec(exceptionLine)?.[1] === 'FileConversionException' && !causedByInput(lines)) {
        return undefined;
    }
    const lastLine = lines[lines.length - 1];
    const reason = lastLine === exceptionLine ? exceptionLine : `${exceptionLine} ${lastLine}`;
    return reason.slice(0, MAX_REASON_CHARS);
}

/** Whether markitdown failed with Python's MemoryError, raised directly or by a converter. */
export function ranOutOfMemory(err: unknown): boolean {
    const lines = stderrLines(err);
    if (lines === undefined) {
        return false;
    }
    return (
        lines.some((line) => FAILED_ATTEMPT.exec(line)?.[1] === 'MemoryError') ||
        EXCEPTION_LINE.exec(lines[lines.length - 1] ?? '')?.[1] === 'MemoryError'
    );
}

/** The non-empty lines of markitdown's stderr when it exited with code 1, as its uncaught exceptions do. */
function stderrLines(err: unknown): string[] | undefined {
    if (!err || typeof err !== 'object') {
        return undefined;
    }
    const { code, stderr } = err as { code?: unknown; stderr?: unknown };
    if (code !== 1 || typeof stderr !== 'string') {
        return undefined;
    }
    return stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/**
 * Whether every converter failure in markitdown's stderr is an input error. markitdown 0.1 lists one line per
 * converter it tried; markitdown 0.0 chains the converter's traceback, whose last line names the error.
 */
function causedByInput(lines: string[]): boolean {
    let causes = lines.flatMap((line) => FAILED_ATTEMPT.exec(line)?.[1] ?? []);
    if (causes.length === 0) {
        const last = EXCEPTION_LINE.exec(lines[lines.length - 1] ?? '')?.[1];
        causes = last === undefined ? [] : [last];
    }
    return causes.length > 0 && causes.every((cause) => INPUT_ERRORS.has(cause.split('.').pop() ?? cause));
}
