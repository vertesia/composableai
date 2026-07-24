import type { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { UserSession } from './UserSession';

function createSession(onboardingProgress: () => Promise<Record<string, boolean>>) {
    const client = {
        account: { onboardingProgress },
    } as unknown as VertesiaClient;
    const setSession = vi.fn<(session: UserSession) => void>();
    const session = new UserSession(client, setSession);
    return { session, setSession };
}

describe('UserSession.fetchOnboardingStatus', () => {
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
