const GENERIC_BINARY_CONTENT_TYPE = 'application/octet-stream';

function normalizedContentType(contentType: string | undefined): string | undefined {
    return contentType?.split(';', 1)[0]?.trim().toLowerCase() || undefined;
}

export function getUploadMimeTypeHint(contentType: string | undefined): string | undefined {
    return normalizedContentType(contentType) === GENERIC_BINARY_CONTENT_TYPE ? undefined : contentType || undefined;
}

export function resolveUploadMimeType(
    sourceContentType: string | undefined,
    inferredContentType: string | undefined,
): string | undefined {
    return getUploadMimeTypeHint(sourceContentType) || inferredContentType || sourceContentType || undefined;
}
