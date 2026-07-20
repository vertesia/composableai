import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    logger: {
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

import {
    fetchComposableToken,
    getComposableToken,
    resolveAuthSelection,
    type TokenAuthorizationError,
} from './composable';

describe('fetchComposableToken', () => {
    const getIdToken = vi.fn(async () => 'identity-token');

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
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

        await expect(fetchComposableToken(getIdToken, 'account-a', 'project-a')).rejects.toMatchObject({
            name: 'TokenAuthorizationError',
            accountId: 'account-a',
            projectId: 'project-a',
            responseMessage: 'Project does not belong to account',
        } satisfies Partial<TokenAuthorizationError>);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-a');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-a')).toBe('project-a');
    });

    it('clears a rejected persisted project without retrying or losing its account', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        localStorage.setItem('composableai.lastSelectedProjectId-account-a', 'project-a');
        const fetchMock = vi
            .fn()
            .mockResolvedValue(new Response('Project does not belong to account', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getComposableToken('account-a', 'project-a', 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-a');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-a')).toBeNull();
    });

    it('clears a rejected persisted account-only scope without retrying', async () => {
        localStorage.setItem('composableai.lastSelectedAccountId', 'account-a');
        const fetchMock = vi.fn().mockResolvedValue(new Response('Account access denied', { status: 403 }));
        vi.stubGlobal('fetch', fetchMock);

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

        await expect(getComposableToken('account-a', 'project-a', 'identity-token', true, true)).rejects.toBeInstanceOf(
            Error,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('composableai.lastSelectedAccountId')).toBe('account-b');
        expect(localStorage.getItem('composableai.lastSelectedProjectId-account-b')).toBe('project-b');
    });
});

describe('resolveAuthSelection', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('composableai.lastSelectedAccountId', 'stored-account');
        localStorage.setItem('composableai.lastSelectedProjectId-stored-account', 'stored-project');
        localStorage.setItem('composableai.lastSelectedProjectId-url-account', 'account-project');
    });

    it('does not combine a URL project with a stored account', () => {
        expect(resolveAuthSelection(new URL('https://app.example.test/?p=url-project'))).toEqual({
            accountId: undefined,
            projectId: 'url-project',
        });
    });

    it('uses an account and project supplied together by the URL', () => {
        expect(resolveAuthSelection(new URL('https://app.example.test/?a=url-account&p=url-project'))).toEqual({
            accountId: 'url-account',
            projectId: 'url-project',
        });
    });

    it('preserves cached project restoration for an account-only URL', () => {
        expect(resolveAuthSelection(new URL('https://app.example.test/?a=url-account'))).toEqual({
            accountId: 'url-account',
            projectId: 'account-project',
        });
    });

    it('restores the complete persisted selection when the URL has no scope', () => {
        expect(resolveAuthSelection(new URL('https://app.example.test/'))).toEqual({
            accountId: 'stored-account',
            projectId: 'stored-project',
        });
    });
});
