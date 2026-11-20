/**
 * Size limits on the sources activities read. Each limit has a default, and can be changed per worker with its
 * environment variable, in MiB.
 */

import { log } from '@temporalio/activity';

const MiB = 1024 * 1024;

/** Largest source written to disk for a document converter (PDF, Office, HTML...). */
export const CONVERTER_MAX_SOURCE_MB_ENV = 'WORKFLOW_CONVERTER_MAX_SOURCE_MB';
/** Most bytes of a DOCX or PPTX the markitdown converter is given to parse, counted once decompressed. */
export const OFFICE_MAX_PARSED_MB_ENV = 'WORKFLOW_OFFICE_MAX_PARSED_MB';
/** Most bytes a DOCX or PPTX given to the markitdown converter may decompress to, all parts counted. */
export const OFFICE_MAX_UNPACKED_MB_ENV = 'WORKFLOW_OFFICE_MAX_UNPACKED_MB';
/** Largest audio or video source downloaded for transcoding, thumbnails and metadata. */
export const MEDIA_MAX_SOURCE_MB_ENV = 'WORKFLOW_MEDIA_MAX_SOURCE_MB';

// A converter runs on a copy of the source on the worker's disk, which every activity on the worker shares.
const DEFAULT_CONVERTER_MAX_SOURCE_MB = 1024;
// markitdown holds a whole Office document in memory several times over: measured at about 9 bytes of memory per
// decompressed byte of a DOCX (text or images) and 7 per byte of PPTX XML. 100 MiB therefore peaks near 1 GiB, so a
// worker should allow about that much memory per concurrent conversion. A small zip can decompress to far more than
// that, so the size of the download alone does not bound it.
const DEFAULT_OFFICE_MAX_PARSED_MB = 100;
// The PPTX reader also decompresses every other part (images, video, embedded files) into memory, at about their own
// size. Within both limits a document peaks near 1.1 GiB (100 MiB of XML, 412 MiB of media).
const DEFAULT_OFFICE_MAX_UNPACKED_MB = 512;
// Media is transcoded from a copy on disk too, next to its renditions: a source this large leaves room for them on a
// worker with a few GiB more disk, and a larger one could never be processed there.
const DEFAULT_MEDIA_MAX_SOURCE_MB = 8192;

export interface SourceLimits {
    /** Largest source handed to a document converter, in bytes. */
    converterMaxBytes: number;
    /** Most decompressed bytes of a DOCX or PPTX handed to markitdown to parse. */
    officeMaxParsedBytes: number;
    /** Most bytes a DOCX or PPTX handed to markitdown may decompress to, all parts counted. */
    officeMaxUnpackedBytes: number;
    /** Largest audio or video source processed, in bytes. */
    mediaMaxBytes: number;
}

/** Message of every {@link logSourceLimitExceeded} line, so one log query finds them all. */
export const SOURCE_LIMIT_EXCEEDED_MESSAGE = 'Source over size limit';

/**
 * The limit a source went over:
 * - `converter`, `office_parsed`, `office_unpacked`, `media`: the limits of {@link getSourceLimits};
 * - `download`: the `maxBytes` of a download that names no other limit;
 * - any other name: a limit of the activity that logs it, such as a provider's own maximum.
 */
export type SourceLimitName = 'converter' | 'office_parsed' | 'office_unpacked' | 'media' | 'download' | (string & {});

export interface SourceLimitExceeded {
    /** The source over the limit: a blob URI or a URL. */
    source: string;
    /** The object whose content the source is, when the activity reads an object. */
    object_id?: string;
    limit: SourceLimitName;
    /** The limit, in bytes. */
    max_bytes: number;
    /** The source's size in bytes, when it is known: a read that stops at the limit never learns it. */
    size?: number;
    /**
     * What became of the read: `rejected` when the source was not processed (the activity skipped it or failed),
     * `truncated` when processing went on with the part within the limit.
     */
    outcome: 'rejected' | 'truncated';
}

/**
 * Log, as a warning, that a source went over a size limit. Every limit logs the same message with the same fields,
 * so their rate and the sources behind them can be reviewed with one query.
 */
export function logSourceLimitExceeded(details: SourceLimitExceeded): void {
    const attributes = { event: 'source_limit_exceeded', ...details };
    try {
        log.warn(SOURCE_LIMIT_EXCEEDED_MESSAGE, attributes);
    } catch {
        // No activity context: the download utilities also run outside activities.
        console.warn(SOURCE_LIMIT_EXCEEDED_MESSAGE, attributes);
    }
}

export function getSourceLimits(): SourceLimits {
    return {
        converterMaxBytes: readMegabytes(CONVERTER_MAX_SOURCE_MB_ENV, DEFAULT_CONVERTER_MAX_SOURCE_MB) * MiB,
        officeMaxParsedBytes: readMegabytes(OFFICE_MAX_PARSED_MB_ENV, DEFAULT_OFFICE_MAX_PARSED_MB) * MiB,
        officeMaxUnpackedBytes: readMegabytes(OFFICE_MAX_UNPACKED_MB_ENV, DEFAULT_OFFICE_MAX_UNPACKED_MB) * MiB,
        mediaMaxBytes: readMegabytes(MEDIA_MAX_SOURCE_MB_ENV, DEFAULT_MEDIA_MAX_SOURCE_MB) * MiB,
    };
}

function readMegabytes(name: string, defaultMb: number): number {
    const raw = typeof process !== 'undefined' ? process.env?.[name]?.trim() : undefined;
    if (!raw) {
        return defaultMb;
    }
    // A plain positive integer: a typo or a unit suffix keeps the default rather than lifting the limit.
    if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) <= 0) {
        console.warn(`[workflow] Invalid ${name}="${raw}"; expected a positive integer of MiB. Using ${defaultMb}`);
        return defaultMb;
    }
    return Number.parseInt(raw, 10);
}
