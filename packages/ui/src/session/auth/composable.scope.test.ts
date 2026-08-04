// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('@vertesia/ui/env', () => ({
    Env: {
        endpoints: { sts: 'https://sts.test', studio: 'https://studio.test' },
        logger,
    },
}));

vi.mock('./firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
    getFirebaseAuthToken: vi.fn(),
}));

function unsignedJwt(payload: Record<string, unknown>): string {
    const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encode(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${encode(JSON.stringify(payload))}.signature`;
}

describe('getComposableToken scope cache', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
        localStorage.clear();
    });

    it('does not reuse a valid token from another project', async () => {
        const accountId = 'account-1';
        const projectA = 'project-a';
        const projectB = 'project-b';
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const token = (project: string) =>
            unsignedJwt({ exp: expiry, account: { id: accountId }, project: { id: project } });
        const response = (project: string) => new Response(JSON.stringify({ token: token(project) }), { status: 200 });
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(response(projectA))
            .mockResolvedValueOnce(response(projectB));

        const { getComposableToken } = await import('./composable');
        const first = await getComposableToken(accountId, projectA, 'central-auth-credential', true);
        const second = await getComposableToken(accountId, projectB, 'central-auth-credential');

        expect(first.token.project?.id).toBe(projectA);
        expect(second.token.project?.id).toBe(projectB);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reuses a valid project token for an account-scoped request in the same account', async () => {
        const accountId = 'account-1';
        const projectId = 'project-a';
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const token = unsignedJwt({ exp: expiry, account: { id: accountId }, project: { id: projectId } });
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({ token }), { status: 200 }));

        const { getComposableToken } = await import('./composable');
        await getComposableToken(accountId, projectId, 'central-auth-credential', true);
        const accountScoped = await getComposableToken(accountId);

        expect(accountScoped.token.project?.id).toBe(projectId);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reuses a valid token for a global request', async () => {
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        const token = unsignedJwt({
            exp: expiry,
            account: { id: 'account-1' },
            project: { id: 'project-a' },
        });
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify({ token }), { status: 200 }));

        const { getComposableToken } = await import('./composable');
        await getComposableToken('account-1', 'project-a', 'central-auth-credential', true);
        const global = await getComposableToken();

        expect(global.token.account.id).toBe('account-1');
        expect(global.token.project?.id).toBe('project-a');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
