import type { ContentSource } from '@vertesia/common';

/** Lowercase hex SHA-256 of `bytes`, or `undefined` where Web Crypto is unavailable (an insecure context). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string | undefined> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return undefined;
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The content source to store for an uploaded file, with its SHA-256 when it was computed. */
export function withContentSha256(uploaded: ContentSource, sha256: string | undefined): ContentSource {
    return sha256 ? { ...uploaded, sha256 } : uploaded;
}

/** What uploads a file's bytes and returns its content source: `client.store.objects`. */
export interface ContentUploader {
    upload(file: File): Promise<ContentSource>;
}

/** Uploads a file and returns its content source, with its SHA-256 when it was computed. */
export async function uploadWithContentSha256(
    uploader: ContentUploader,
    file: File,
    sha256: string | undefined,
): Promise<ContentSource> {
    return withContentSha256(await uploader.upload(file), sha256);
}

/** The hashes of a file to upload: `sha256` for objects that store one, `hash` (MD5) for older objects' etags. */
export interface FileHashes {
    hash?: string;
    sha256?: string;
}

/**
 * Whether a stored object holds the same bytes as the file. An object that stores `content.sha256` is compared on it.
 * An object stored before the field is compared on its etag, which is the MD5 of its bytes on most storage (not on an
 * S3 object encrypted with a KMS key, or uploaded in parts). A hash the browser could not compute matches nothing, so
 * `undefined` never equals a missing field.
 */
export function matchesStoredContent(
    file: FileHashes,
    content: { etag?: string; sha256?: string } | undefined,
): boolean {
    if (!content) return false;
    if (content.sha256) return !!file.sha256 && content.sha256 === file.sha256;
    return !!file.hash && content.etag === file.hash;
}

/** True when the server rejected `content.sha256`: a server older than the field refuses undeclared properties. */
export function isContentSha256Rejected(err: unknown): boolean {
    if (!(err instanceof Error) || (err as { status?: unknown }).status !== 400) return false;
    const payload = (err as { payload?: unknown }).payload;
    const text = `${err.message} ${typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')}`;
    return /\bsha256\b/.test(text);
}

/**
 * Writes an object with `content`, and again without its SHA-256 if the server does not know the field, so uploads
 * keep working against an older server; duplicate detection then falls back to the etag there.
 */
export async function writeWithContentSha256<T>(
    content: ContentSource,
    write: (content: ContentSource) => Promise<T>,
): Promise<T> {
    try {
        return await write(content);
    } catch (err: unknown) {
        if (!content.sha256 || !isContentSha256Rejected(err)) throw err;
        const { sha256: _sha256, ...withoutSha256 } = content;
        return await write(withoutSha256);
    }
}
