import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeJwt(payload: Record<string, unknown>) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

async function importComposableAuth(authTokenProvider?: () => Promise<string | undefined>) {
    vi.resetModules();
    const [{ Env }, composableAuth] = await Promise.all([import('@vertesia/ui/env'), import('./composable')]);
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
        authTokenProvider,
    });
    return composableAuth;
}

describe('getComposableToken', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('uses an authorization-bearing STS-issued Vertesia token directly instead of exchanging it', async () => {
        const token = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            account_roles: [],
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['developer'],
        });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        const result = await getComposableToken('account-id', 'project-id', token, false, true);

        expect(result.rawToken).toBe(token);
        expect(result.token.iss).toBe('https://sts.dev1.vertesia.io');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reacquires a fresh injected token instead of reusing an expired cached credential', async () => {
        const expiredToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) - 60,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['developer'],
        });
        const freshToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['developer'],
        });
        const authTokenProvider = vi.fn(() => Promise.resolve(freshToken));
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth(authTokenProvider);
        const result = await getComposableToken('account-id', 'project-id', expiredToken, false, true);

        expect(result.rawToken).toBe(freshToken);
        expect(authTokenProvider).toHaveBeenCalledOnce();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falls back to the cached credential when the injected provider is unavailable', async () => {
        const expiringToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 60,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['developer'],
        });
        const refreshedToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['developer'],
        });
        const authTokenProvider = vi.fn(() => Promise.resolve(undefined));
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ token: refreshedToken }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth(authTokenProvider);
        const result = await getComposableToken('account-id', 'project-id', expiringToken, false, true);

        expect(result.rawToken).toBe(refreshedToken);
        expect(authTokenProvider).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${expiringToken}` });
    });

    it('exchanges a bare STS-issued Vertesia token so roles can be hydrated', async () => {
        const sourceToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
        });
        const exchangedToken = makeJwt({
            iss: 'https://sts.dev1.vertesia.io',
            exp: Math.floor(Date.now() / 1000) + 3600,
            account: { id: 'account-id', name: 'Account' },
            account_roles: [],
            project: { id: 'project-id', name: 'Project', account: 'account-id' },
            project_roles: ['admin'],
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

    it('does not relax a rejected account and project scope', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        localStorage.setItem('composableai.lastSelectedProjectId-account-a', 'project-a');
        const fetchMock = vi.fn().mockResolvedValue(
            new Response('Project does not belong to account', {
                status: 403,
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const { fetchComposableToken } = await importComposableAuth();
        const getIdToken = vi.fn(async () => 'identity-token');
        await expect(fetchComposableToken(getIdToken, 'account-a', 'project-a')).rejects.toMatchObject({
            name: 'RequestedScopeUnavailableError',
            accountId: 'account-a',
            projectId: 'project-a',
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-a');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-a')).toBe('project-a');
    });

    it('clears a rejected persisted account/project pair without retrying', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        localStorage.setItem('composableai.lastSelectedProjectId-account-a', 'project-a');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response('Project does not belong to account', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        await expect(getComposableToken('account-a', 'project-a', 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBeNull();
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-a')).toBeNull();
    });

    it('clears a rejected persisted account-only scope without retrying', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        const fetchMock = vi.fn().mockResolvedValue(new Response('Account access denied', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        await expect(getComposableToken('account-a', undefined, 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBeNull();
    });

    it('does not clear an unrelated persisted selection', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-b');
        localStorage.setItem('composableai.lastSelectedProjectId-account-b', 'project-b');
        const fetchMock = vi.fn().mockResolvedValue(new Response('Project access denied', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

        const { getComposableToken } = await importComposableAuth();
        await expect(getComposableToken('account-a', 'project-a', 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-b');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-b')).toBe('project-b');
    });

    it('preserves an unrelated persisted project within the rejected URL account', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        localStorage.setItem('composableai.lastSelectedProjectId-account-a', 'project-b');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Project access denied', { status: 403 })));

        const { getComposableToken } = await importComposableAuth();
        await expect(getComposableToken('account-a', 'project-a', 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-a');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-a')).toBe('project-b');
    });

    it('classifies coded scope failures and keeps the deprecated type alias compatible', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                Response.json(
                    {
                        error: 'Forbidden',
                        message: 'safe message',
                        errorCode: 'requested_scope_unavailable',
                    },
                    { status: 403 },
                ),
            ),
        );

        const { fetchComposableToken, RequestedScopeUnavailableError, TokenAuthorizationError } =
            await importComposableAuth();
        const identityToken = makeJwt({ email: 'leon@example.com', name: 'Leon Ruggiero' });
        const error = await fetchComposableToken(async () => identityToken, 'account-a', 'project-a').catch(
            (caught) => caught,
        );

        expect(error).toBeInstanceOf(RequestedScopeUnavailableError);
        expect(error).toBeInstanceOf(TokenAuthorizationError);
        expect(error).toMatchObject({
            accountId: 'account-a',
            errorCode: 'requested_scope_unavailable',
            identity: { email: 'leon@example.com', name: 'Leon Ruggiero' },
            message: 'safe message',
            projectId: 'project-a',
            status: 403,
        });
    });

    it('classifies users with no accessible account separately', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(
                    Response.json(
                        { error: 'Forbidden', message: 'safe message', errorCode: 'no_accessible_account' },
                        { status: 403 },
                    ),
                ),
        );

        const { fetchComposableToken, NoAccessibleAccountError, isNoAccessibleAccountError } =
            await importComposableAuth();
        const identityToken = makeJwt({ email: 'leon@example.com' });
        const error = await fetchComposableToken(async () => identityToken).catch((caught) => caught);

        expect(error).toBeInstanceOf(NoAccessibleAccountError);
        expect(isNoAccessibleAccountError(error)).toBe(true);
        expect(error).toMatchObject({
            errorCode: 'no_accessible_account',
            identity: { email: 'leon@example.com' },
            message: 'safe message',
            status: 403,
        });
    });

    it.each([
        { status: 401, errorName: 'CredentialError' },
        { status: 500, errorName: 'AuthenticationServiceError' },
    ])(
        'classifies STS status $status as $errorName without exposing its response body',
        async ({ status, errorName }) => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive internal detail', { status })));

            const { fetchComposableToken } = await importComposableAuth();
            const error = await fetchComposableToken(async () => 'identity-token').catch((caught) => caught);

            expect(error).toMatchObject({ name: errorName });
            expect(error.message).not.toContain('sensitive internal detail');
        },
    );
});

describe('resolveAuthSelection', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('composableai.lastSelectedAccountId', 'stored-account');
        localStorage.setItem('composableai.lastSelectedProjectId-stored-account', 'stored-project');
        localStorage.setItem('composableai.lastSelectedProjectId-url-account', 'account-project');
    });

    it('does not combine a URL project with a stored account', async () => {
        const { resolveAuthSelection } = await importComposableAuth();
        expect(resolveAuthSelection(new URL('https://app.example.test/?p=url-project'))).toEqual({
            accountId: undefined,
            projectId: 'url-project',
        });
    });

    it('uses an account and project supplied together by the URL', async () => {
        const { resolveAuthSelection } = await importComposableAuth();
        expect(resolveAuthSelection(new URL('https://app.example.test/?a=url-account&p=url-project'))).toEqual({
            accountId: 'url-account',
            projectId: 'url-project',
        });
    });

    it('preserves cached project restoration for an account-only URL', async () => {
        const { resolveAuthSelection } = await importComposableAuth();
        expect(resolveAuthSelection(new URL('https://app.example.test/?a=url-account'))).toEqual({
            accountId: 'url-account',
            projectId: 'account-project',
        });
    });

    it('restores the complete persisted selection when the URL has no scope', async () => {
        const { resolveAuthSelection } = await importComposableAuth();
        expect(resolveAuthSelection(new URL('https://app.example.test/'))).toEqual({
            accountId: 'stored-account',
            projectId: 'stored-project',
        });
    });
});
