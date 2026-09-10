import type { VertesiaClient } from '@vertesia/client';
import { type AuthTokenPayload, PrincipalType } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
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
