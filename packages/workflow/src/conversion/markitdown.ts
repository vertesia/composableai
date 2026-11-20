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
 * markitdown's own exceptions for a document it cannot read. Its command-line tool does not catch them, so they end
 * the process with exit code 1 and a traceback on stderr.
 */
const REJECTION_PATTERN = /\b(?:FileConversionException|UnsupportedFormatException)\b/;

/** Characters of markitdown's error quoted in a {@link DocumentConversionError}. */
const MAX_REASON_CHARS = 1000;

/**
 * The only variables markitdown is given. It parses untrusted documents, so it does not get the worker's credentials;
 * these are what Python needs to find its tools, a temporary directory and a locale.
 */
const ENV_ALLOWLIST = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ'];

/** Parts of a PPTX that python-pptx parses; it leaves media as bytes, which cost about their own size. */
const PPTX_PARSED_PART = /\.(?:xml|rels)$/i;

/**
 * Convert a DOCX or PPTX file to Markdown with markitdown.
 *
 * The document is checked before it is converted: markitdown holds all of it in memory several times over, and a
 * small zip can decompress to gigabytes, so a document over the `officeMaxParsedBytes` limit of
 * {@link getSourceLimits} is refused.
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
    await checkParsedSize(file, format, source);
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

/** Bytes of the document markitdown parses, counted decompressed. */
export function parsedSize(format: MarkitdownFormat, entries: ZipEntry[]): number {
    let size = 0;
    for (const entry of entries) {
        // mammoth also turns every DOCX image into a base64 data URI, which costs as much memory as XML does.
        if (format === 'docx' || PPTX_PARSED_PART.test(entry.name)) {
            size += entry.uncompressedSize;
        }
    }
    return size;
}

async function checkParsedSize(file: string, format: MarkitdownFormat, source: string): Promise<void> {
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
    const size = parsedSize(format, entries);
    const maxBytes = getSourceLimits().officeMaxParsedBytes;
    if (size > maxBytes) {
        logSourceLimitExceeded({ source, limit: 'office_parsed', max_bytes: maxBytes, size, outcome: 'rejected' });
        throw new SourceTooLargeError(source, maxBytes, size);
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
 * Why markitdown rejected the document, when the failure is one of its exceptions for an unreadable document: the
 * line that names the exception, and the last line of stderr, which states the underlying error (such as
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
    const exceptionLine = lines.findLast((line) => REJECTION_PATTERN.test(line));
    if (exceptionLine === undefined) {
        return undefined;
    }
    const lastLine = lines[lines.length - 1];
    const reason = lastLine === exceptionLine ? exceptionLine : `${exceptionLine} ${lastLine}`;
    return reason.slice(0, MAX_REASON_CHARS);
}
