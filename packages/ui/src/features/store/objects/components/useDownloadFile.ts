import { VertesiaClient, ZenoClient } from "@vertesia/client";
import { MarkdownRenditionFormat, RenderMarkdownPayload } from "@vertesia/common";
import { useCallback, useState } from "react";
import { ToastFn } from "@vertesia/ui/core";

export interface UseDownloadFileOptions {
    client: VertesiaClient | ZenoClient;
    toast: ToastFn;
}

export interface RenderAndDownloadOptions {
    /** Format to render to */
    format: MarkdownRenditionFormat;
    /** Title for the document */
    title?: string;
    /** Artifact run ID for resolving artifact URLs in content */
    artifactRunId?: string;
    /** Additional Pandoc options */
    pandocOptions?: string[];
}

export interface UseDownloadFileResult {
    /** Download a file from a content source URI (gs:// or file path) via the files API */
    downloadFromContentSource: (uri: string, filename?: string) => Promise<void>;
    /** Download a file from a direct URL (already signed or public) */
    downloadFromUrl: (url: string, filename?: string) => void;
    /** Render a document by objectId to PDF/DOCX and download the result */
    renderDocument: (objectId: string, options: RenderAndDownloadOptions) => Promise<void>;
    /** Render markdown content to PDF/DOCX and download the result */
    renderContent: (content: string, options: RenderAndDownloadOptions) => Promise<void>;
    /** Whether a download is currently in progress */
    isDownloading: boolean;
}

/**
 * Hook for downloading files from various sources.
 * Handles GCS URIs (via client.files API), direct URLs, and markdown rendering.
 */
export function useDownloadFile({ client, toast }: UseDownloadFileOptions): UseDownloadFileResult {
    const [isDownloading, setIsDownloading] = useState(false);

    /**
     * Download a file from a content source URI using the files API to get a signed URL.
     */
    const downloadFromContentSource = useCallback(async (uri: string, filename?: string) => {
        if (!uri) return;

        setIsDownloading(true);
        try {
            const result = await client.files.getDownloadUrlWithOptions({
                file: uri,
                name: filename
            });

            // Trigger download
            triggerDownload(result.url, filename);
        } catch (err) {
            toast({
                status: "error",
                title: "Download failed",
                description: err instanceof Error ? err.message : "Failed to get download URL",
                duration: 5000,
            });
        } finally {
            setIsDownloading(false);
        }
    }, [client, toast]);

    /**
     * Download a file from a direct URL (already signed or public).
     */
    const downloadFromUrl = useCallback((url: string, filename?: string) => {
        if (!url) return;
        triggerDownload(url, filename);
    }, []);

    /**
     * Internal helper to handle the render result and trigger download.
     */
    const handleRenderResult = useCallback(async (
        payload: RenderMarkdownPayload,
        filename: string
    ) => {
        // Get the store client (ZenoClient has rendering, VertesiaClient has store.rendering)
        const storeClient = 'store' in client ? client.store : client;

        const rendition = await storeClient.rendering.render(payload);

        // Use download_url if available (direct signed URL), otherwise fall back to file_uri
        if (rendition.download_url) {
            triggerDownload(rendition.download_url, filename);
        } else if (rendition.file_uri) {
            const result = await client.files.getDownloadUrlWithOptions({
                file: rendition.file_uri,
                name: filename
            });
            triggerDownload(result.url, filename);
        } else {
            throw new Error("No download URL or file URI in response");
        }
    }, [client]);

    /**
     * Render a document by objectId and download the result.
     */
    const renderDocument = useCallback(async (
        objectId: string,
        options: RenderAndDownloadOptions
    ) => {
        setIsDownloading(true);
        try {
            const filename = `${options.title || "document"}.${options.format}`;

            await handleRenderResult({
                object_id: objectId,
                format: options.format,
                title: options.title,
                pandoc_options: options.pandocOptions,
            }, filename);

            toast({
                status: "success",
                title: "Document exported",
                description: `Successfully exported to ${options.format.toUpperCase()}`,
                duration: 2000,
            });
        } catch (err) {
            toast({
                status: "error",
                title: "Export failed",
                description: err instanceof Error ? err.message : "Failed to export document",
                duration: 5000,
            });
        } finally {
            setIsDownloading(false);
        }
    }, [handleRenderResult, toast]);

    /**
     * Render markdown content and download the result.
     */
    const renderContent = useCallback(async (
        content: string,
        options: RenderAndDownloadOptions
    ) => {
        setIsDownloading(true);
        try {
            const filename = `${options.title || "export"}.${options.format}`;

            await handleRenderResult({
                content,
                format: options.format,
                title: options.title,
                artifact_run_id: options.artifactRunId,
                pandoc_options: options.pandocOptions,
            }, filename);

            toast({
                status: "success",
                title: "Content exported",
                description: `Successfully exported to ${options.format.toUpperCase()}`,
                duration: 2000,
            });
        } catch (err) {
            toast({
                status: "error",
                title: "Export failed",
                description: err instanceof Error ? err.message : "Failed to export content",
                duration: 5000,
            });
        } finally {
            setIsDownloading(false);
        }
    }, [handleRenderResult, toast]);

    return {
        downloadFromContentSource,
        downloadFromUrl,
        renderDocument,
        renderContent,
        isDownloading,
    };
}

/**
 * Trigger a file download in the browser.
 * Attempts to fetch and create a blob for proper filename control.
 * Falls back to direct link if CORS blocks the fetch.
 */
function triggerDownload(url: string, filename?: string): void {
    // Try to fetch and create blob for proper filename control
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.blob();
        })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename || getFilenameFromUrl(url);
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }, 100);
        })
        .catch(() => {
            // CORS or fetch failed - fall back to direct link download
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || getFilenameFromUrl(url);
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
        });
}

/**
 * Extract filename from URL path.
 */
function getFilenameFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split("/");
        return segments[segments.length - 1] || "download";
    } catch {
        return "download";
    }
}
