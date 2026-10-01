import type { VertesiaClient } from '@vertesia/client';
import { type AuthTokenPayload, PrincipalType } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as composable from './auth/composable';
import { UserSession } from './UserSession';

const projectToken: AuthTokenPayload = {
    sub: 'test-user',
    name: 'Test User',
    type: PrincipalType.User,
    account: { id: 'test-account', name: 'Test Account' },
    account_roles: [],
    accounts: [],
    project: { id: 'test-project', name: 'Test Project', account: 'test-account' },
    apps: [],
    iss: 'https://auth.example.com',
    aud: 'test-client',
    exp: 4102444800,
};

function encodeToken(payload: AuthTokenPayload): string {
    return `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify(payload))}.`;
}

function createSession(onboardingProgress: () => Promise<Record<string, boolean>>) {
    const client = {
        account: { onboardingProgress },
        withAuthCallback: vi.fn(),
    } as unknown as VertesiaClient;
    const setSession = vi.fn<(session: UserSession) => void>();
    const session = new UserSession(client, setSession);
    session.authToken = { ...projectToken };
    return { session, setSession };
}

describe('UserSession.fetchOnboardingStatus', () => {
    it('skips onboarding before authentication without publishing a status', async () => {
        const onboardingProgress = vi.fn(async () => ({ project_created: true }));
        const { session, setSession } = createSession(onboardingProgress);
        session.authToken = undefined;

        await expect(session.fetchOnboardingStatus()).resolves.toBe(false);
        expect(onboardingProgress).not.toHaveBeenCalled();
        expect(session.onboardingComplete).toBeUndefined();
        expect(setSession).not.toHaveBeenCalled();
    });

    it('defers onboarding during account-only login and loads it after project selection', async () => {
        const onboardingProgress = vi.fn(async () => ({ project_created: true }));
        const { session, setSession } = createSession(onboardingProgress);

        await session.login(encodeToken({ ...projectToken, project: undefined }));
        expect(onboardingProgress).not.toHaveBeenCalled();
        expect(session.onboardingComplete).toBeUndefined();
        expect(setSession).not.toHaveBeenCalled();

        await session.login(encodeToken(projectToken));
        expect(onboardingProgress).toHaveBeenCalledOnce();
        expect(session.onboardingComplete).toBe(true);
        expect(setSession).toHaveBeenCalledOnce();
    });

    it('does not replace the session when an incomplete status is unchanged', async () => {
        const { session, setSession } = createSession(async () => ({ project_created: false }));
        session.onboardingComplete = false;

        await expect(session.fetchOnboardingStatus()).resolves.toBe(false);
        expect(setSession).not.toHaveBeenCalled();
    });

    it('updates the session and reports when onboarding becomes complete', async () => {
        const { session, setSession } = createSession(async () => ({ project_created: true }));
        session.onboardingComplete = false;

        await expect(session.fetchOnboardingStatus()).resolves.toBe(true);
        expect(setSession).toHaveBeenCalledOnce();
        expect(setSession.mock.calls[0]?.[0]?.onboardingComplete).toBe(true);
    });

    it('publishes the initial incomplete status without reporting completion', async () => {
        const { session, setSession } = createSession(async () => ({ project_created: false }));

        await expect(session.fetchOnboardingStatus()).resolves.toBe(false);
        expect(setSession).toHaveBeenCalledOnce();
        expect(setSession.mock.calls[0]?.[0]?.onboardingComplete).toBe(false);
    });
});

describe('UserSession.signOut', () => {
    it('keeps the receiver when used as a callback, including cloned sessions', () => {
        const { session } = createSession(async () => ({}));
        const clone = session.clone();
        const logout = vi.spyOn(session, 'logout').mockImplementation(() => undefined);
        const cloneLogout = vi.spyOn(clone, 'logout').mockImplementation(() => undefined);
        const { signOut } = session;
        const { signOut: signOutClone } = clone;

        signOut();
        expect(logout).toHaveBeenCalledOnce();
        expect(cloneLogout).not.toHaveBeenCalled();
        signOutClone();
        expect(cloneLogout).toHaveBeenCalledOnce();
        expect(logout).toHaveBeenCalledOnce();
    });
});

describe('UserSession token scope', () => {
    function sessionWithRefreshedToken(next: AuthTokenPayload) {
        const rawToken = encodeToken(next);
        vi.spyOn(composable, 'getComposableToken').mockResolvedValue({ rawToken, token: next, error: false });
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        const { session } = createSession(async () => ({}));
        return { session, rawToken, reload };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('adopts a refreshed token in the same scope', async () => {
        const { session, rawToken, reload } = sessionWithRefreshedToken({ ...projectToken, exp: 4102444900 });

        await expect(session.rawAuthToken).resolves.toBe(rawToken);
        expect(session.authToken?.exp).toBe(4102444900);
        expect(reload).not.toHaveBeenCalled();
    });

    it.each([
        ['project', { ...projectToken, project: { id: 'other-project', name: 'Other', account: 'test-account' } }],
        ['account', { ...projectToken, account: { id: 'other-account', name: 'Other' } }],
    ])('reloads instead of sending a token for another %s', async (_scope, next) => {
        const { session, reload } = sessionWithRefreshedToken(next);

        await expect(session.rawAuthToken).rejects.toThrow(/changed/);
        expect(reload).toHaveBeenCalledOnce();
        expect(session.authToken?.project?.id).toBe('test-project');
    });

    it('reloads instead of publishing a forced refresh for another project', async () => {
        const next = { ...projectToken, project: { id: 'other-project', name: 'Other', account: 'test-account' } };
        const { session, reload } = sessionWithRefreshedToken(next);

        await expect(session.refreshAuthToken()).rejects.toThrow(/changed/);
        expect(reload).toHaveBeenCalledOnce();
        expect(session.setSession).not.toHaveBeenCalled();
    });

    it('lets an account-only session gain a project without reloading', async () => {
        const { session, reload } = sessionWithRefreshedToken(projectToken);
        session.authToken = { ...projectToken, project: undefined };

        await session.rawAuthToken;
        expect(session.authToken?.project?.id).toBe('test-project');
        expect(reload).not.toHaveBeenCalled();
    });
});
