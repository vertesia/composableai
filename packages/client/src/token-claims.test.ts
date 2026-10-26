import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

const REFERENCE = 'R'.repeat(43);
function jwt(claims: Record<string, unknown>) {
    return `e30.${Buffer.from(JSON.stringify({ exp: 4_000_000_000, ...claims })).toString('base64url')}.signature`;
}
function client(token: string, transport = vi.fn<typeof fetch>()) {
    return new VertesiaClient({
        serverUrl: 'https://studio.example',
        storeUrl: 'https://store.example',
        tokenServerUrl: 'https://sts.example',
        apikey: token,
        fetch: transport,
    });
}

describe('client ABAC resolution', () => {
    it('returns inline, absent and legacy ABAC without a request', async () => {
        const transport = vi.fn<typeof fetch>();
        const abac = { read: [{ region: 'emea' }] };
        await expect(client(jwt({}), transport).getAbac()).resolves.toBeUndefined();
        await expect(client(jwt({ abac }), transport).getAbac()).resolves.toEqual(abac);
        await expect(client(jwt({ content_security: abac }), transport).getAbac()).resolves.toEqual(abac);
        expect(transport).not.toHaveBeenCalled();
    });

    it('resolves through the configured STS transport once per token, including concurrent calls', async () => {
        const abac = { read: [{ region: 'emea' }] };
        const transport = vi.fn<typeof fetch>(async () => Response.json({ valid: true, payload: { abac } }));
        const token = jwt({ abac: REFERENCE });
        const sdk = client(token, transport);
        expect((await sdk.getDecodedJWT())?.abac).toBe(REFERENCE);
        await expect(Promise.all([sdk.getAbac(), sdk.getAbac()])).resolves.toEqual([abac, abac]);
        await expect(sdk.getAbac()).resolves.toEqual(abac);
        expect(transport).toHaveBeenCalledOnce();
        const [url, init] = transport.mock.calls[0];
        const request = new Request(url, init);
        expect(request.url).toBe('https://sts.example/validate');
        expect(await request.json()).toEqual({ token });
    });

    it('invalidates cached authorization context when the auth callback rotates the token', async () => {
        const transport = vi.fn<typeof fetch>(async () =>
            Response.json({
                valid: true,
                payload: { abac: { read: [{ region: 'emea' }] } },
            }),
        );
        let current = jwt({ abac: REFERENCE });
        const sdk = client(current, transport);
        sdk.withAuthCallback(async () => `Bearer ${current}`);
        await sdk.getAbac();
        current = jwt({ abac: { read: [{ region: 'apac' }] } });
        await expect(sdk.getAbac()).resolves.toEqual({ read: [{ region: 'apac' }] });
        expect(transport).toHaveBeenCalledOnce();
    });

    it('never treats unresolved authorization context as unrestricted, and retries failures', async () => {
        const transport = vi.fn<typeof fetch>(async () => Response.json({ valid: false }));
        const sdk = client(jwt({ abac: REFERENCE }), transport);
        await expect(sdk.getAbac()).rejects.toThrow('STS could not resolve');
        await expect(sdk.getAbac()).rejects.toThrow('STS could not resolve');
        expect(transport).toHaveBeenCalledTimes(2);
    });
});
