/**
 * Size limits on the sources activities read. Each limit has a default, and can be changed per worker with its
 * environment variable, in MiB.
 */

const MiB = 1024 * 1024;

/** Largest source written to disk for a document converter (PDF, Office, HTML...). */
export const CONVERTER_MAX_SOURCE_MB_ENV = 'WORKFLOW_CONVERTER_MAX_SOURCE_MB';
/** Largest audio or video source downloaded for transcoding, thumbnails and metadata. */
export const MEDIA_MAX_SOURCE_MB_ENV = 'WORKFLOW_MEDIA_MAX_SOURCE_MB';

// A converter runs on a copy of the source on the worker's disk, which every activity on the worker shares.
const DEFAULT_CONVERTER_MAX_SOURCE_MB = 1024;
// Media is transcoded from a copy on disk too, next to its renditions: a source this large leaves room for them on a
// worker with a few GiB more disk, and a larger one could never be processed there.
const DEFAULT_MEDIA_MAX_SOURCE_MB = 8192;

export interface SourceLimits {
    /** Largest source handed to a document converter, in bytes. */
    converterMaxBytes: number;
    /** Largest audio or video source processed, in bytes. */
    mediaMaxBytes: number;
}

export function getSourceLimits(): SourceLimits {
    return {
        converterMaxBytes: readMegabytes(CONVERTER_MAX_SOURCE_MB_ENV, DEFAULT_CONVERTER_MAX_SOURCE_MB) * MiB,
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
