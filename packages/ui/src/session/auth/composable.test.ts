import type { AuthTokenPayload } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@vertesia/ui/env', () => ({
    Env: {
        endpoints: {
            sts: 'https://sts.example.test',
            studio: 'https://studio.example.test',
        },
        logger: mocks.logger,
    },
}));

vi.mock('./firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
    getFirebaseAuthToken: vi.fn(),
}));

import { fetchComposableToken, STSError, tokenMatchesSelection } from './composable';

const ACCOUNT_KEY = 'composableai.lastSelectedAccountId';
const PROJECT_KEY = 'composableai.lastSelectedProjectId';

function createToken(accountId: string, projectId?: string, projectAccountId = accountId): string {
    const payload = {
        exp: Math.floor(Date.now() / 1000) + 3600,
        account: { id: accountId, name: `Account ${accountId}` },
        project: projectId ? { id: projectId, name: `Project ${projectId}`, account: projectAccountId } : undefined,
    };
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}

function tokenResponse(token: string): Response {
    return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function requestBodies(fetchMock: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
    return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

describe('fetchComposableToken', () => {
    const getIdToken = vi.fn(async () => 'identity-token');
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        getIdToken.mockClear();
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('keeps the requested account when a stale project is rejected', async () => {
        localStorage.setItem(ACCOUNT_KEY, 'account-a');
        localStorage.setItem(`${PROJECT_KEY}-account-a`, 'project-stale');
        const expectedToken = createToken('account-a', 'project-current');
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 403 }))
            .mockResolvedValueOnce(tokenResponse(expectedToken));

        const token = await fetchComposableToken(getIdToken, 'account-a', 'project-stale');

        expect(token).toBe(expectedToken);
        expect(requestBodies(fetchMock)).toEqual([
            { type: 'user', account_id: 'account-a', project_id: 'project-stale' },
            { type: 'user', account_id: 'account-a' },
        ]);
        expect(localStorage.getItem(ACCOUNT_KEY)).toBe('account-a');
        expect(localStorage.getItem(`${PROJECT_KEY}-account-a`)).toBeNull();
    });

    it('only falls back to an unscoped token after the requested account is also rejected', async () => {
        localStorage.setItem(ACCOUNT_KEY, 'account-stale');
        localStorage.setItem(`${PROJECT_KEY}-account-stale`, 'project-stale');
        fetchMock
            .mockResolvedValueOnce(new Response(null, { status: 403 }))
            .mockResolvedValueOnce(new Response(null, { status: 403 }))
            .mockResolvedValueOnce(tokenResponse(createToken('account-default', 'project-default')));

        await fetchComposableToken(getIdToken, 'account-stale', 'project-stale');

        expect(requestBodies(fetchMock)).toEqual([
            { type: 'user', account_id: 'account-stale', project_id: 'project-stale' },
            { type: 'user', account_id: 'account-stale' },
            { type: 'user' },
        ]);
        expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
        expect(localStorage.getItem(`${PROJECT_KEY}-account-stale`)).toBeNull();
    });

    it('does not retry an unscoped authorization failure', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(fetchComposableToken(getIdToken)).rejects.toThrow('Failed to get composable token');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a successful STS response with a different account without clearing the selection', async () => {
        localStorage.setItem(ACCOUNT_KEY, 'account-a');
        localStorage.setItem(`${PROJECT_KEY}-account-a`, 'project-a');
        fetchMock.mockResolvedValueOnce(tokenResponse(createToken('account-b', 'project-a')));

        await expect(fetchComposableToken(getIdToken, 'account-a', 'project-a')).rejects.toBeInstanceOf(STSError);
        expect(localStorage.getItem(ACCOUNT_KEY)).toBe('account-a');
        expect(localStorage.getItem(`${PROJECT_KEY}-account-a`)).toBe('project-a');
    });
});

describe('tokenMatchesSelection', () => {
    const token = {
        account: { id: 'account-a', name: 'Account A' },
        project: { id: 'project-a', name: 'Project A', account: 'account-a' },
    } as AuthTokenPayload;

    it('matches the requested account and project', () => {
        expect(tokenMatchesSelection(token, 'account-a', 'project-a')).toBe(true);
        expect(tokenMatchesSelection(token, 'account-b', 'project-a')).toBe(false);
        expect(tokenMatchesSelection(token, 'account-a', 'project-b')).toBe(false);
    });

    it('rejects internally inconsistent token scope', () => {
        const inconsistentToken = {
            ...token,
            project: { ...token.project, account: 'account-b' },
        } as AuthTokenPayload;

        expect(tokenMatchesSelection(inconsistentToken)).toBe(false);
        expect(tokenMatchesSelection({} as AuthTokenPayload)).toBe(false);
    });
});
