import { describe, expect, it, vi } from 'vitest';
import type { VertesiaClient } from './client.js';
import { executeInteractionByName } from './execute.js';

describe('executeInteractionByName', () => {
    it('forwards private per-request headers without placing them in the execution payload', async () => {
        const post = vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed' });
        const client = { post } as unknown as VertesiaClient;

        await executeInteractionByName(client, 'sys:test', { data: { message: 'hello' } }, undefined, {
            headers: { 'x-vertesia-required-tool-name': 'app_workspace_init' },
        });

        expect(post).toHaveBeenCalledWith(
            '/api/v1/execute',
            expect.objectContaining({
                headers: { 'x-vertesia-required-tool-name': 'app_workspace_init' },
                payload: expect.not.objectContaining({ required_tool_name: expect.anything() }),
            }),
        );
    });
});
