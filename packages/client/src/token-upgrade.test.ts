import { expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

it('upgrades the supplied bearer through STS without changing the client credentials', async () => {
    const result = { token: 'existing-jwt', token_type: 'Bearer', expires_in: 100, jwt_version: 0 };
    const transport = vi.fn<typeof fetch>(async () => Response.json(result));
    const client = new VertesiaClient({
        serverUrl: 'https://api.example',
        storeUrl: 'https://store.example',
        tokenServerUrl: 'https://sts.example',
        apikey: 'original-client-credential',
        fetch: transport,
    });
    expect(await client.upgradeToken('existing-jwt')).toEqual(result);
    const [url, options] = transport.mock.calls[0];
    const request = new Request(url, options);
    expect(request.url).toBe('https://sts.example/token/upgrade');
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer existing-jwt');
    expect(await request.json()).toEqual({});
    await client.get('/probe');
    const [nextUrl, nextOptions] = transport.mock.calls[1];
    expect(new Request(nextUrl, nextOptions).headers.get('authorization')).toBe('Bearer original-client-credential');
});

it('preserves the unsupported-version error for the recovery caller', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
        Response.json(
            {
                error: 'Conflict',
                message: 'No converter',
                errorCode: 'TOKEN_UPGRADE_UNSUPPORTED',
                jwt_version: 0,
            },
            { status: 409 },
        ),
    );
    const client = new VertesiaClient({
        serverUrl: 'https://api.example',
        storeUrl: 'https://store.example',
        fetch: transport,
    });
    await expect(client.upgradeToken('existing-jwt')).rejects.toMatchObject({
        status: 409,
        payload: { errorCode: 'TOKEN_UPGRADE_UNSUPPORTED', jwt_version: 0 },
    });
    expect(transport).toHaveBeenCalledOnce();
});
