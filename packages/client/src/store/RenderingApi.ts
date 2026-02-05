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
}