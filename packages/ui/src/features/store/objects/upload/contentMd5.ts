import type { ContentSource } from '@vertesia/common';

/**
 * The content source to store for an uploaded file. Its MD5 is added only when the storage etag is not that MD5: an
 * S3 object encrypted with a KMS key, or uploaded in parts, has an etag that is not its MD5, so duplicate detection
 * would not find it by etag.
 */
export function withContentMd5(uploaded: ContentSource, md5: string | undefined): ContentSource {
    if (!md5 || uploaded.etag === md5) return uploaded;
    return { ...uploaded, md5 };
}

/** What uploads a file's bytes and returns its content source: `client.store.objects`. */
export interface ContentUploader {
    upload(file: File): Promise<ContentSource>;
}

/** Uploads a file and returns its content source, with its MD5 when the storage etag is not that MD5. */
export async function uploadWithContentMd5(
    uploader: ContentUploader,
    file: File,
    md5: string | undefined,
): Promise<ContentSource> {
    return withContentMd5(await uploader.upload(file), md5);
}

/**
 * Whether a stored object holds the same bytes as a file whose MD5 is `hash`. A file whose hash could not be computed
 * matches nothing: an object with neither field would otherwise compare `undefined` with `undefined`.
 */
export function matchesContentHash(hash: string | undefined, content: { etag?: string; md5?: string } | undefined) {
    if (!hash || !content) return false;
    return content.md5 === hash || content.etag === hash;
}

/** True when the server rejected `content.md5`: a server older than the field refuses undeclared properties. */
export function isContentMd5Rejected(err: unknown): boolean {
    if (!(err instanceof Error) || (err as { status?: unknown }).status !== 400) return false;
    const payload = (err as { payload?: unknown }).payload;
    const text = `${err.message} ${typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')}`;
    return /\bmd5\b/.test(text);
}

/**
 * Writes an object with `content`, and again without its MD5 if the server does not know the field, so uploads keep
 * working against an older server; duplicate detection then falls back to the etag there.
 */
export async function writeWithContentMd5<T>(
    content: ContentSource,
    write: (content: ContentSource) => Promise<T>,
): Promise<T> {
    try {
        return await write(content);
    } catch (err: unknown) {
        if (!content.md5 || !isContentMd5Rejected(err)) throw err;
        const { md5: _md5, ...withoutMd5 } = content;
        return await write(withoutMd5);
    }
}
