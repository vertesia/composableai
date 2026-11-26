import type { ZenoClient } from '@vertesia/client';
import type { GetFileUrlResponse } from '@vertesia/common';
import { useCallback, useEffect, useMemo } from 'react';

type Download = Pick<GetFileUrlResponse, 'url' | 'authentication_required' | 'mime_type'>;
type FileReader = Pick<ZenoClient['files'], 'fetchDownloadUrl'> &
    Partial<Pick<ZenoClient['files'], 'isAuthenticatedDownloadUrl'>>;

// A blob URL inherits the origin of Studio. Do not let an uploaded HTML or SVG run on that origin.
const PASSIVE_MEDIA = /^(?:image\/(?:png|jpeg|gif|webp|avif|bmp)|(?:audio|video)\/[a-z0-9.+-]+)$/i;

export async function fetchBrowserFile(files: FileReader, download: Download): Promise<Blob> {
    const response = await files.fetchDownloadUrl(download.url);
    if (!response.ok) throw new Error(`Could not download file (HTTP ${response.status})`);
    const blob = await response.blob();
    const type = download.mime_type?.split(';')[0] ?? blob.type;
    return blob.slice(0, blob.size, PASSIVE_MEDIA.test(type) ? type : 'application/octet-stream');
}

/** Resolve a ticket for an element that cannot send the user's Authorization header. */
export function useBrowserFileUrl(files: FileReader, source: string | undefined) {
    // Keep the original source identity even when its next download uses a different ticket.
    const view = useMemo(() => ({ source, files, urls: new Set<string>(), active: true }), [source, files]);
    useEffect(() => {
        view.active = true;
        return () => {
            view.active = false;
            for (const url of view.urls) URL.revokeObjectURL(url);
            view.urls.clear();
        };
    }, [view]);
    return useCallback(
        async (download: Download) => {
            if (!download.authentication_required && !view.files.isAuthenticatedDownloadUrl?.(download.url))
                return download.url;
            const blob = await fetchBrowserFile(view.files, download);
            if (!view.active) throw new DOMException('Preview closed', 'AbortError');
            const url = URL.createObjectURL(blob);
            view.urls.add(url);
            return url;
        },
        [view],
    );
}
