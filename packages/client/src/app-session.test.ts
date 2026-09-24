import { expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

it('mints an app session through STS with the caller authorization and declared scopes', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
        Response.json({ token: 'scoped', token_type: 'Bearer', expires_in: 900 }),
    );
    const client = new VertesiaClient({
        serverUrl: 'https://api.example',
        storeUrl: 'https://store.example',
        tokenServerUrl: 'https://sts.example',
        apikey: 'caller',
        fetch: transport,
    });
    const result = await client.mintAppSessionToken({ app_name: 'analytics', scopes: ['content:read'] });
    expect(result.token).toBe('scoped');
    const [url, options] = transport.mock.calls[0];
    const request = new Request(url, options);
    expect(request.url).toBe('https://sts.example/token/app-session');
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer caller');
    expect(await request.json()).toEqual({ app_name: 'analytics', scopes: ['content:read'] });
});
