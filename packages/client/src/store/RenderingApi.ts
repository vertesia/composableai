import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    isWorkflowTerminalStatus,
    RenderMarkdownPollOptions,
    RenderMarkdownPayload,
    RenderMarkdownStartResponse,
    RenderMarkdownStatusResponse,
    RenderMarkdownResponse,
    WorkflowExecutionStatus,
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
     * @param payload - Rendering options including format and either object_id or inline content
     * @returns Rendering result with download URL
     *
     * @example
     * // Render an existing markdown document
     * const result = await client.rendering.render({
     *     format: MarkdownRenditionFormat.pdf,
     *     object_id: "doc-123"
     * });
     * // Download from result.download_url
     *
     * @example
     * // Render inline markdown content
     * const result = await client.rendering.render({
     *     format: MarkdownRenditionFormat.docx,
     *     content: "# My Report\n\nContent here...",
     *     title: "My Report"
     * });
     */
    start(payload: RenderMarkdownPayload): Promise<RenderMarkdownStartResponse> {
        return this.post("/jobs", { payload });
    }

    getStatus(
        workflowId: string,
        workflowRunId: string,
    ): Promise<RenderMarkdownStatusResponse> {
        return this.get("/jobs/status", {
            query: {
                workflow_id: workflowId,
                workflow_run_id: workflowRunId,
            },
        });
    }

    async render(
        payload: RenderMarkdownPayload,
        options: RenderMarkdownPollOptions = {},
    ): Promise<RenderMarkdownResponse> {
        const pollIntervalMs = options.pollIntervalMs ?? 1500;
        const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

        const started = await this.start(payload);
        if (!started.workflow_id || !started.workflow_run_id) {
            throw new Error("Failed to start rendering workflow");
        }

        const startTime = Date.now();

        // Poll until workflow reaches terminal state.
        while (true) {
            const status = await this.getStatus(started.workflow_id, started.workflow_run_id);

            if (status.status === WorkflowExecutionStatus.COMPLETED) {
                if (!status.download_url && !status.file_uri) {
                    throw new Error(status.error || "Rendering completed but no output file was produced");
                }
                return {
                    status: "success",
                    format: payload.format,
                    download_url: status.download_url,
                    file_uri: status.file_uri,
                };
            }

            if (isWorkflowTerminalStatus(status.status)) {
                const statusLabel = WorkflowExecutionStatus[status.status] || String(status.status);
                throw new Error(status.error || `Rendering failed with status: ${statusLabel}`);
            }

            if (Date.now() - startTime >= timeoutMs) {
                throw new Error(`Rendering timed out after ${timeoutMs}ms`);
            }

            await sleep(pollIntervalMs);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
