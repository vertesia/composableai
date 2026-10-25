/** Maximum UTF-8 size persisted for extracted document text. */
export const MAX_EXTRACTED_TEXT_BYTES = 10 * 1024 * 1024;

/**
 * Request-body allowance for the JSON envelope carrying extracted text and its source etag.
 * This is transport headroom, not a larger stored-text limit.
 */
export const SET_OBJECT_TEXT_BODY_LIMIT_BYTES = 16 * 1024 * 1024;

export const EXTRACTED_TEXT_TRUNCATION_MARKER = '\n\n[... truncated at max text limit 10 MiB ...]';

export interface ExtractedTextLimitResult {
    text: string;
    truncated: boolean;
}

/**
 * Retain the largest Unicode-safe prefix that fits together with the truncation marker.
 * The marker is part of the byte budget, so persisted text never exceeds the declared limit.
 */
export function truncateExtractedText(text: string): ExtractedTextLimitResult {
    if (utf8PrefixEnd(text, MAX_EXTRACTED_TEXT_BYTES) === text.length) {
        return { text, truncated: false };
    }

    const markerBytes = utf8ByteLength(EXTRACTED_TEXT_TRUNCATION_MARKER);
    const prefixEnd = utf8PrefixEnd(text, MAX_EXTRACTED_TEXT_BYTES - markerBytes);
    return {
        text: text.slice(0, prefixEnd) + EXTRACTED_TEXT_TRUNCATION_MARKER,
        truncated: true,
    };
}

function utf8ByteLength(text: string): number {
    let bytes = 0;
    for (let index = 0; index < text.length; ) {
        const codePoint = text.codePointAt(index) ?? 0;
        bytes += utf8CodePointBytes(codePoint);
        index += codePoint > 0xffff ? 2 : 1;
    }
    return bytes;
}

function utf8PrefixEnd(text: string, maxBytes: number): number {
    let bytes = 0;
    let index = 0;
    while (index < text.length) {
        const codePoint = text.codePointAt(index) ?? 0;
        const codePointBytes = utf8CodePointBytes(codePoint);
        if (bytes + codePointBytes > maxBytes) {
            break;
        }
        bytes += codePointBytes;
        index += codePoint > 0xffff ? 2 : 1;
    }
    return index;
}

function utf8CodePointBytes(codePoint: number): number {
    if (codePoint <= 0x7f) return 1;
    if (codePoint <= 0x7ff) return 2;
    if (codePoint <= 0xffff) return 3;
    return 4;
}
