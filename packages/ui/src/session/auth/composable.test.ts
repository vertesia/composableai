import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeJwt(payload: Record<string, unknown>) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

async function importComposableAuth() {
    vi.resetModules();
    const [{ Env }, composableAuth] = await Promise.all([
        import('@vertesia/ui/env'),
        import('./composable'),
    ]);
    Env.init({
        name: 'test',
        version: '0.0.0',
        isLocalDev: false,
        isDocker: false,
        type: 'test',
        endpoints: {
            studio: 'https://studio-server-dev-feat-appgen.api.dev1.vertesia.io',
            zeno: 'https://zeno-server-dev-feat-appgen.api.dev1.vertesia.io',
            sts: 'https://sts.dev1.vertesia.io',
        },
    });
    return composableAuth;
}

describe('getComposableToken', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses an STS-issued Vertesia token directly instead of exchanging it', async () => {
        const token = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
        });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        const result = await getComposableToken(undefined, undefined, token, false, true);

        expect(result.rawToken).toBe(token);
        expect(result.token.iss).toBe('https://sts.dev1.vertesia.io');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still exchanges a non-STS source token', async () => {
        const sourceToken = makeJwt({
            iss: 'https://securetoken.google.com/example',
            exp: Math.floor(Date.now() / 1000) + 3600,
            email: 'user@example.com',
        });
        const exchangedToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ token: exchangedToken }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        const result = await getComposableToken('account-id', 'project-id', sourceToken, false, true);

        expect(result.rawToken).toBe(exchangedToken);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe('https://sts.dev1.vertesia.io/token/issue');
    });
});
