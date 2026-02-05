import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    RenderMarkdownPayload,
    RenderMarkdownResponse,
} from "@vertesia/common";

/**
 * API for rendering markdown documents to PDF or DOCX.
 * Rendering is performed on workflow workers (not on the API server).
 */
export class RenderingApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/rendering");
    }

    /**
     * Render markdown content to PDF or DOCX.
     *
     * @param payload - Rendering options including format and either objectId or inline content
     * @returns Rendering result with download URL
     *
     * @example
     * // Render an existing markdown document
     * const result = await client.rendering.render({
     *     format: MarkdownRenditionFormat.pdf,
     *     objectId: "doc-123"
     * });
     * // Download from result.downloadUrl
     *
     * @example
     * // Render inline markdown content
     * const result = await client.rendering.render({
     *     format: MarkdownRenditionFormat.docx,
     *     content: "# My Report\n\nContent here...",
     *     title: "My Report"
     * });
     */
    render(payload: RenderMarkdownPayload): Promise<RenderMarkdownResponse> {
        return this.post("/markdown", { payload });
    }

    /**
     * Render markdown content and trigger download in browser.
     *
     * @param payload - Rendering configuration
     * @param filename - Optional filename override (defaults to title or "export")
     */
    async downloadMarkdown(payload: RenderMarkdownPayload, filename?: string): Promise<void> {
        const result = await this.render(payload);

        if (result.status === "error") {
            throw new Error(result.error || "Rendering failed");
        }

        if (!result.downloadUrl) {
            throw new Error("No download URL returned");
        }

        // Determine filename
        const ext = payload.format === "pdf" ? "pdf" : "docx";
        const name = filename
            ?? (payload.title ? `${payload.title.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}` : `export.${ext}`);

        // Fetch the file and trigger download
        const response = await fetch(result.downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
        }
        const blob = await response.blob();

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
