import { act, fireEvent, render, screen } from '@testing-library/react';
import { VertesiaClient } from '@vertesia/client';
import type { AuthTokenPayload, SystemRoleDefinition } from '@vertesia/common';
import { Button } from '@vertesia/ui/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PermissionLoadingScreenProps, UserPermissionProvider } from './UserPermissionsProvider';

const session = {
    client: new VertesiaClient({ serverUrl: 'https://studio.example.test', storeUrl: 'https://store.example.test' }),
    authToken: { sub: 'user-a', account_roles: [] } as unknown as AuthTokenPayload,
    signOut: vi.fn(),
};
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => session }));

function renderProvider() {
    return render(
        <UserPermissionProvider>
            <div>Protected workspace</div>
        </UserPermissionProvider>,
    );
}

async function advance(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('role mapping recovery', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(1);
        session.authToken = { sub: 'user-a', account_roles: [] } as unknown as AuthTokenPayload;
        session.signOut.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it.each([0, 502, 503, 504])(
        'recovers automatically from status %s without rendering protected content early',
        async (status) => {
            const fetch = vi
                .spyOn(session.client.iam.roles, 'listSystem')
                .mockRejectedValueOnce(Object.assign(new Error('JWKSTimeout'), { status }))
                .mockResolvedValue([]);
            renderProvider();
            expect(screen.queryByText('Protected workspace')).toBeNull();
            await advance(0);
            expect(screen.getByRole('status').textContent).toContain('automatically');
            expect(screen.queryByText('JWKSTimeout')).toBeNull();
            await advance(1_000);
            expect(screen.getByText('Protected workspace')).toBeTruthy();
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole('alert')).toBeNull();
        },
    );

    it('stops after one minute and lets a manual retry recover without navigating', async () => {
        const fetch = vi
            .spyOn(session.client.iam.roles, 'listSystem')
            .mockRejectedValue(Object.assign(new Error('JWKSTimeout'), { status: 503 }));
        const location = window.location.href;
        renderProvider();
        await advance(60_000);
        expect(screen.getByRole('alert').textContent).toContain('couldn’t connect');
        const calls = fetch.mock.calls.length;
        await advance(60_000);
        expect(fetch).toHaveBeenCalledTimes(calls);
        fetch.mockResolvedValue([]);
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await advance(0);
        expect(screen.getByText('Protected workspace')).toBeTruthy();
        expect(window.location.href).toBe(location);
    });

    it('does not restart recovery when authentication re-decodes the same JWT', async () => {
        const fetch = vi.spyOn(session.client.iam.roles, 'listSystem').mockImplementation(async () => {
            session.authToken = { ...session.authToken };
            throw Object.assign(new Error('Unavailable'), { status: 503 });
        });
        renderProvider();
        await advance(60_000);
        expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
        const calls = fetch.mock.calls.length;
        await advance(10_000);
        expect(fetch).toHaveBeenCalledTimes(calls);
        fetch.mockImplementation(async () => {
            session.authToken = { ...session.authToken };
            return [];
        });
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await advance(0);
        expect(screen.getByText('Protected workspace')).toBeTruthy();
        expect(fetch).toHaveBeenCalledTimes(calls + 1);
    });

    it('bounds a hung request and ignores its late success', async () => {
        let resolve!: (roles: SystemRoleDefinition[]) => void;
        const fetch = vi.spyOn(session.client.iam.roles, 'listSystem').mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                }),
        );
        renderProvider();
        await advance(60_000);
        expect(fetch.mock.calls[0][0]?.signal?.aborted).toBe(true);
        await act(async () => resolve([]));
        expect(screen.queryByText('Protected workspace')).toBeNull();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });

    it.each([401, 403, 400, 500])('does not automatically retry status %s', async (status) => {
        const fetch = vi
            .spyOn(session.client.iam.roles, 'listSystem')
            .mockRejectedValue(Object.assign(new Error('Request failed'), { status }));
        renderProvider();
        await advance(60_000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Protected workspace')).toBeNull();
        if (status === 401 || status === 403) {
            fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }));
            expect(session.signOut).toHaveBeenCalledOnce();
        }
    });

    it('cancels retries on unmount', async () => {
        const fetch = vi
            .spyOn(session.client.iam.roles, 'listSystem')
            .mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }));
        const view = renderProvider();
        await advance(0);
        view.unmount();
        await advance(60_000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]?.signal?.aborted).toBe(true);
    });

    it('ignores the previous session’s pending response after a token change', async () => {
        let resolveOld!: (roles: SystemRoleDefinition[]) => void;
        const fetch = vi
            .spyOn(session.client.iam.roles, 'listSystem')
            .mockImplementationOnce(
                () =>
                    new Promise((done) => {
                        resolveOld = done;
                    }),
            )
            .mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
        const view = renderProvider();
        session.authToken = { sub: 'user-b', account_roles: [] } as unknown as AuthTokenPayload;
        view.rerender(
            <UserPermissionProvider>
                <div>Protected workspace</div>
            </UserPermissionProvider>,
        );
        await advance(0);
        await act(async () => resolveOld([]));
        expect(fetch.mock.calls[0][0]?.signal?.aborted).toBe(true);
        expect(screen.queryByText('Protected workspace')).toBeNull();
        expect(screen.getByRole('alert').textContent).toContain('Access Denied');
    });

    it('uses permissions embedded in the token without fetching mappings', () => {
        session.authToken = { ...session.authToken, permissions: [] };
        const fetch = vi.spyOn(session.client.iam.roles, 'listSystem');
        renderProvider();
        expect(screen.getByText('Protected workspace')).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });
    it.each([401, 403, 500])('supplies working recovery actions to a custom screen for status %s', async (status) => {
        const fetch = vi
            .spyOn(session.client.iam.roles, 'listSystem')
            .mockRejectedValue(Object.assign(new Error('Request failed'), { status }));
        const CustomScreen = ({ status: phase, onAction, actionLabel }: PermissionLoadingScreenProps) => (
            <main>
                <p>Custom {phase}</p>
                {phase === 'error' && <Button onClick={onAction}>{actionLabel}</Button>}
            </main>
        );
        const view = render(
            <UserPermissionProvider LoadingScreen={CustomScreen}>
                <div>Protected workspace</div>
            </UserPermissionProvider>,
        );
        expect(view.container.firstElementChild?.tagName).toBe('MAIN');
        expect(screen.getByText('Custom loading')).toBeTruthy();
        expect(screen.queryByText('Protected workspace')).toBeNull();
        await advance(0);
        expect(screen.getByText('Custom error')).toBeTruthy();
        expect(screen.queryByText('Protected workspace')).toBeNull();
        fetch.mockResolvedValue([]);
        fireEvent.click(screen.getByRole('button'));
        await advance(0);
        if (status === 401 || status === 403) {
            expect(session.signOut).toHaveBeenCalledOnce();
            expect(screen.queryByText('Protected workspace')).toBeNull();
        } else {
            expect(screen.getByText('Protected workspace')).toBeTruthy();
            expect(screen.queryByText('Custom error')).toBeNull();
        }
    });

    it('reports automatic retrying to a custom screen before revealing protected content', async () => {
        vi.spyOn(session.client.iam.roles, 'listSystem')
            .mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
            .mockResolvedValue([]);
        render(
            <UserPermissionProvider LoadingScreen={({ status }) => <main>Custom {status}</main>}>
                <div>Protected workspace</div>
            </UserPermissionProvider>,
        );
        await advance(0);
        expect(screen.getByText('Custom retrying')).toBeTruthy();
        expect(screen.queryByText('Protected workspace')).toBeNull();
        await advance(1_000);
        expect(screen.getByText('Protected workspace')).toBeTruthy();
    });
});
