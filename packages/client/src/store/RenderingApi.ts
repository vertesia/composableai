import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { RenderMarkdownPayload } from "@vertesia/common";

/**
 * API for rendering content to various formats (PDF, DOCX)
 */
export class RenderingApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/rendering");
    }

    /**
     * Render markdown content to PDF or DOCX
     *
     * @param payload - Rendering configuration
     * @returns Blob containing the rendered document
     *
     * @example
     * // Render inline markdown to PDF
     * const blob = await client.store.rendering.markdown({
     *     content: "# Hello\n\nThis is a test.",
     *     format: "pdf",
     *     title: "My Document"
     * });
     *
     * @example
     * // Render an object's content to DOCX
     * const blob = await client.store.rendering.markdown({
     *     objectId: "doc-123",
     *     format: "docx"
     * });
     *
     * @example
     * // Render with a custom template
     * const blob = await client.store.rendering.markdown({
     *     content: markdownContent,
     *     format: "docx",
     *     templateUrl: "https://example.com/templates/report.docx",
     *     pandocOptions: ["--toc", "--number-sections"]
     * });
     */
    async markdown(payload: RenderMarkdownPayload): Promise<Blob> {
        // Validate payload
        if (!payload.content && !payload.objectId) {
            throw new Error('Either content or objectId is required');
        }
        if (payload.content && payload.objectId) {
            throw new Error('Provide either content or objectId, not both');
        }
        if (!payload.format || !['pdf', 'docx'].includes(payload.format)) {
            throw new Error('format must be "pdf" or "docx"');
        }

        // Make the request - need raw response for binary data
        const response = await this.post('/markdown', {
            payload,
            reader: (res: Response) => res,
        }) as Response;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Rendering failed: ${response.status} ${errorText}`);
        }

        return response.blob();
    }

    /**
     * Render markdown content and trigger download in browser
     *
     * @param payload - Rendering configuration
     * @param filename - Optional filename override (defaults to title or "export")
     */
    async downloadMarkdown(payload: RenderMarkdownPayload, filename?: string): Promise<void> {
        const blob = await this.markdown(payload);

        // Determine filename
        const ext = payload.format === 'pdf' ? 'pdf' : 'docx';
        const name = filename
            ?? (payload.title ? `${payload.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.${ext}` : `export.${ext}`);

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
