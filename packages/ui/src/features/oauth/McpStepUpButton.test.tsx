import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { McpStepUpButton } from './McpStepUpButton.js';
import type { UseOAuthPopupOptions } from './useOAuthPopup.js';

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(),
    openOAuthPopup: vi.fn(),
    popupOptions: undefined as UseOAuthPopupOptions | undefined,
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: { remoteMcpConnections: { authorize: mocks.authorize } } }),
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
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue({ authorization_url: 'https://auth.example.com/authorize' });
    });

    it('authorizes again with the refused scope and reports success with what was not granted', async () => {
        const onGranted = renderButton();

        fireEvent.click(screen.getByRole('button', { name: 'Grant permission' }));

        await waitFor(() => expect(mocks.openOAuthPopup).toHaveBeenCalledWith('https://auth.example.com/authorize'));
        expect(mocks.authorize).toHaveBeenCalledWith('app1', 'jira', {
            required_scope: 'write:jira-work',
            refused_tool: 'jira__create_issue',
            scope_mode: 'union',
        });

        mocks.popupOptions?.onComplete({ success: true, missing_scope: 'write:jira-work' });
        expect(onGranted).toHaveBeenCalledWith('write:jira-work');
    });

    it('offers to ask for the refused scope alone when the authorization server answers invalid_scope', async () => {
        const onGranted = renderButton();

        fireEvent.click(screen.getByRole('button', { name: 'Grant permission' }));
        await waitFor(() => expect(mocks.openOAuthPopup).toHaveBeenCalled());
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

    it('does not resume the agent when the popup closes without completing', async () => {
        const onGranted = renderButton();

        fireEvent.click(screen.getByRole('button', { name: 'Grant permission' }));
        await waitFor(() => expect(mocks.openOAuthPopup).toHaveBeenCalled());
        mocks.popupOptions?.onComplete(undefined);

        expect(onGranted).not.toHaveBeenCalled();
    });
});
