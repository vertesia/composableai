import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { McpStepUpButton } from './McpStepUpButton.js';
import type { UseOAuthPopupOptions } from './useOAuthPopup.js';

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    getCollectionStatus: vi.fn(),
    openOAuthPopup: vi.fn(),
    popupOptions: undefined as UseOAuthPopupOptions | undefined,
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            remoteMcpConnections: { authorize: mocks.authorize, getCollectionStatus: mocks.getCollectionStatus },
        },
    }),
}));

vi.mock('./useOAuthPopup.js', () => ({
    useOAuthPopup: (options: UseOAuthPopupOptions) => {
        mocks.popupOptions = options;
        return { openOAuthPopup: mocks.openOAuthPopup };
    },
}));

function renderButton(onGranted = vi.fn()) {
    renderWithProviders(
        <McpStepUpButton
            appId="app1"
            collectionId="jira"
            collectionName="Jira"
            requiredScope="write:jira-work"
            refusedTool="jira__create_issue"
            onGranted={onGranted}
        />,
    );
    return onGranted;
}

describe('McpStepUpButton', () => {
    const AUTH_URL = 'https://auth.example.com/authorize';

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue({
            authorization_url: AUTH_URL,
            state: 'state-1',
            step_up_attempt: 'attempt-1',
        });
    });

    async function grant() {
        fireEvent.click(screen.getByRole('button', { name: 'Grant permission' }));
        await waitFor(() => expect(mocks.openOAuthPopup).toHaveBeenCalled());
    }

    it('authorizes again with the refused scope, for this attempt only', async () => {
        renderButton();
        await grant();

        expect(mocks.authorize).toHaveBeenCalledWith('app1', 'jira', {
            required_scope: 'write:jira-work',
            refused_tool: 'jira__create_issue',
            scope_mode: 'union',
        });
        expect(mocks.openOAuthPopup).toHaveBeenCalledWith(AUTH_URL, { state: 'state-1' });
    });

    it('resumes once the status confirms the grant of this attempt, even without a callback message', async () => {
        mocks.getCollectionStatus.mockResolvedValue({
            authenticated: true,
            step_up_attempt: 'attempt-1',
            scope: 'read:jira-work',
        });
        const onGranted = renderButton();
        await grant();

        // An app on another origin never gets the callback page's message: the popup just closes.
        mocks.popupOptions?.onComplete(undefined);

        await waitFor(() => expect(onGranted).toHaveBeenCalledWith('write:jira-work'));
        expect(mocks.getCollectionStatus).toHaveBeenCalledWith('app1', 'jira');
    });

    it('offers the refused scope alone after an unconfirmed attempt, which an app on another origin needs', async () => {
        mocks.getCollectionStatus.mockResolvedValue({ authenticated: true });
        const onGranted = renderButton();
        await grant();

        // The authorization server refused the union with invalid_scope, but the message never reached this origin.
        mocks.popupOptions?.onComplete(undefined);

        fireEvent.click(await screen.findByRole('button', { name: 'Ask for this permission only' }));
        await waitFor(() =>
            expect(mocks.authorize).toHaveBeenLastCalledWith(
                'app1',
                'jira',
                expect.objectContaining({ scope_mode: 'challenged' }),
            ),
        );
        expect(onGranted).not.toHaveBeenCalled();
    });

    it('does not resume on a grant from another attempt', async () => {
        mocks.getCollectionStatus.mockResolvedValue({ authenticated: true, step_up_attempt: 'attempt-other' });
        const onGranted = renderButton();
        await grant();

        mocks.popupOptions?.onComplete({ success: true });

        await waitFor(() => expect(mocks.getCollectionStatus).toHaveBeenCalled());
        await waitFor(() =>
            expect((screen.getByRole('button', { name: 'Grant permission' }) as HTMLButtonElement).disabled).toBe(
                false,
            ),
        );
        expect(onGranted).not.toHaveBeenCalled();
    });

    it("trusts this attempt's own callback message on a server without attempt ids", async () => {
        mocks.authorize.mockResolvedValue({ authorization_url: AUTH_URL, state: 'state-1' });
        const onGranted = renderButton();
        await grant();

        mocks.popupOptions?.onComplete({ success: true, missing_scope: 'write:jira-work', state: 'state-1' });

        await waitFor(() => expect(onGranted).toHaveBeenCalledWith('write:jira-work'));
        expect(mocks.getCollectionStatus).not.toHaveBeenCalled();
    });

    it('does not resume when the popup closes without completing on a server without attempt ids', async () => {
        mocks.authorize.mockResolvedValue({ authorization_url: AUTH_URL, state: 'state-1' });
        const onGranted = renderButton();
        await grant();

        mocks.popupOptions?.onComplete(undefined);

        await waitFor(() =>
            expect((screen.getByRole('button', { name: 'Grant permission' }) as HTMLButtonElement).disabled).toBe(
                false,
            ),
        );
        expect(onGranted).not.toHaveBeenCalled();
    });

    it('offers to ask for the refused scope alone when the authorization server answers invalid_scope', async () => {
        const onGranted = renderButton();
        await grant();

        mocks.popupOptions?.onComplete({ success: false, error: 'invalid_scope', error_code: 'invalid_scope' });

        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        await waitFor(() =>
            expect(mocks.authorize).toHaveBeenLastCalledWith(
                'app1',
                'jira',
                expect.objectContaining({ scope_mode: 'challenged' }),
            ),
        );
        expect(onGranted).not.toHaveBeenCalled();
    });
});
