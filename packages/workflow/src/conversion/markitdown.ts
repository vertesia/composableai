import { DocumentConversionError, SourceTooLargeError } from '../errors.js';
import { getSourceLimits, logSourceLimitExceeded } from '../utils/source-limits.js';
import { type ConvertOptions, convertWithTool } from './convert-with-tool.js';
import { InvalidZipError, readZipEntries, type ZipEntry } from './office-zip.js';

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

/** The exception line Python prints last: `zipfile.BadZipFile: File is not a zip file`. */
const EXCEPTION_LINE = /^([\w.]+):/;

/** Characters of markitdown's error quoted in a {@link DocumentConversionError}. */
const MAX_REASON_CHARS = 1000;

/**
 * The only variables markitdown is given. It parses untrusted documents, so it does not get the worker's credentials;
 * these are what Python needs to find its tools, a temporary directory and a locale.
 */
const ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];

/** Parts of a PPTX that python-pptx parses as XML; it also loads every other part, as bytes of about their own size. */
const PPTX_PARSED_PART = /\.(?:xml|rels)$/i;

/**
 * Convert a DOCX or PPTX file to Markdown with markitdown.
 *
 * The document is checked before it is converted: markitdown holds all of it in memory, the parts it parses several
 * times over, and a small zip can decompress to gigabytes. A document over the `officeMaxParsedBytes` or the
 * `officeMaxUnpackedBytes` limit of {@link getSourceLimits} is refused.
 *
 * @param file path of the document; markitdown picks its converter from the extension, so it must end with `.docx`
 *   or `.pptx`
 * @param format the document's format
 * @throws SourceTooLargeError when the document decompresses to more than markitdown may parse
 * @throws DocumentConversionError when the file is not a valid document of its format; it is not retried
 */
export async function markdownWithMarkitdown(
    file: string,
    format: MarkitdownFormat,
    options: MarkitdownOptions = {},
): Promise<string> {
    const source = options.source ?? file;
    await checkSize(file, format, source);
    try {
        return await convertWithTool(
            'markitdown',
            file,
            undefined,
            'md',
            (inputFile, outputFile) => [inputFile, '-o', outputFile],
            {
                maxOutputBytes: options.maxOutputBytes,
                env: markitdownEnv(),
            },
        );
    } catch (err: unknown) {
        const reason = rejectionReason(err);
        if (reason === undefined) {
            // A crash, a kill or a timeout: a retry may succeed.
            throw err;
        }
        throw new DocumentConversionError(
            `markitdown cannot convert the ${format.toUpperCase()} ${source}: ${reason}`,
            err instanceof Error ? err : undefined,
        );
    }
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
    const env: NodeJS.ProcessEnv = {};
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
    if (!err || typeof err !== 'object') {
        return undefined;
    }
    const { code, stderr } = err as { code?: unknown; stderr?: unknown };
    if (code !== 1 || typeof stderr !== 'string') {
        return undefined;
    }
    const lines = stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
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
