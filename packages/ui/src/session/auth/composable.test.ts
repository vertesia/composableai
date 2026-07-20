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

import { fetchComposableToken, type TokenAuthorizationError } from './composable';

describe('fetchComposableToken', () => {
    const getIdToken = vi.fn(async () => 'identity-token');

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('does not relax or clear a rejected account and project scope', async () => {
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
});
