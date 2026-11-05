import { MarkdownRenditionFormat, type RenderMarkdownStatusResponse, WorkflowExecutionStatus } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { ZenoClient } from './client.js';

/** Answers the start request, then each status request with the given status. */
function renderingClient(status: RenderMarkdownStatusResponse) {
    const fetchRendering = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const started = new Request(input, init).method === 'POST';
        const body = started
            ? {
                  workflow_id: 'wf-1',
                  workflow_run_id: 'run-1',
                  status: WorkflowExecutionStatus.RUNNING,
                  format: MarkdownRenditionFormat.pdf,
              }
            : status;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    return new ZenoClient({ serverUrl: 'https://zeno.test', fetch: fetchRendering });
}

const COMPLETED: RenderMarkdownStatusResponse = {
    workflow_id: 'wf-1',
    workflow_run_id: 'run-1',
    status: WorkflowExecutionStatus.COMPLETED,
    file_uri: 'gs://bucket/out.pdf',
};

describe('RenderingApi.render', () => {
    const payload = { content: '# Title', format: MarkdownRenditionFormat.pdf };

    it('returns the warnings of a completed render', async () => {
        const warnings = ['Image a.png was not embedded'];

        const response = await renderingClient({ ...COMPLETED, warnings }).rendering.render(payload);

        expect(response.warnings).toEqual(warnings);
    });

    it('returns no warnings when the render had none', async () => {
        const response = await renderingClient(COMPLETED).rendering.render(payload);

        expect(response.warnings).toBeUndefined();
    });
});
