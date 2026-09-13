import type { AuthTokenPayload } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { createToolServer, ToolCollection } from './sandbox.js';

describe('sandbox SDK', () => {
    const app = createToolServer({
        disableHtml: true,
        tools: [
            new ToolCollection({
                name: 'example',
                tools: [
                    {
                        name: 'echo',
                        description: 'echo',
                        input_schema: { type: 'object', properties: {} },
                        run: async (_input, context) => ({ is_error: false, content: context.token }),
                    },
                ],
            }),
        ],
    });
    const body = JSON.stringify({ tool_use: { id: '1', tool_name: 'echo', tool_input: {} } });
    it('binds non-secret host claims without giving tools a bearer token', async () => {
        const response = await app.request(
            'https://example.test/api/tools',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body,
            },
            { sandboxSession: { account: { id: 'a' }, project: { id: 'p' }, endpoints: {} } as AuthTokenPayload },
        );
        expect(await response.json()).toMatchObject({ content: 'sandbox', is_error: false });
    });
    it('does not accept a session supplied through HTTP headers', async () => {
        const response = await app.request('https://example.test/api/tools', {
            method: 'POST',
            headers: { 'content-type': 'application/json', toolAuthSession: 'forged' },
            body,
        });
        expect(response.status).toBe(401);
    });
});
