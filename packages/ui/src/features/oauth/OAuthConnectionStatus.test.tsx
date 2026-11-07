import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { ToastContext } from '../../core/components/toast/ToastContext.js';
import { OAuthProviderConnectButton } from './OAuthProviderConnectButton.js';
import { RemoteMcpConnectionButton } from './RemoteMcpConnectionButton.js';

const mocks = vi.hoisted(() => ({
    getCollectionStatus: vi.fn(),
    getProviderStatus: vi.fn(),
    authorize: vi.fn(),
    disconnect: vi.fn(),
    popupError: undefined as ((error: string) => void) | undefined,
}));

const mockClient = {
    oauthProviders: { getStatus: mocks.getProviderStatus, authorize: mocks.authorize },
    remoteMcpConnections: {
        getCollectionStatus: mocks.getCollectionStatus,
        authorize: mocks.authorize,
        disconnect: mocks.disconnect,
    },
};

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: mockClient }),
}));

vi.mock('./useOAuthPopup.js', () => ({
    useOAuthPopup: ({ onError }: { onError?: (error: string) => void }) => {
        mocks.popupError = onError;
        return { openOAuthPopup: vi.fn() };
    },
}));

const outage = () => Object.assign(new Error('Service Unavailable'), { status: 503 });
const collectionStatus = (authenticated: boolean) => ({
    authenticated,
    collection_id: 'jira',
    collection_name: 'Jira',
    mcp_server_url: 'https://mcp.example.com',
});

afterEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockRestore();
});

describe('OAuthProviderConnectButton', () => {
    it('does not offer Authenticate when the status check got no answer, and retries it', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getProviderStatus.mockRejectedValueOnce(outage());
        renderWithProviders(<OAuthProviderConnectButton oauthProviderId="provider" />);

        const retry = await screen.findByRole('button', { name: 'Status unknown. Retry' });
        expect(screen.queryByRole('button', { name: 'Authenticate' })).toBeNull();

        mocks.getProviderStatus.mockResolvedValueOnce({ authenticated: true });
        fireEvent.click(retry);

        expect(await screen.findByText('Connected')).not.toBeNull();
        expect(screen.queryByText('Status unknown')).toBeNull();
    });

    it('still offers Authenticate when the server answered with a 4xx', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getProviderStatus.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
        renderWithProviders(<OAuthProviderConnectButton oauthProviderId="provider" />);

        expect(await screen.findByRole('button', { name: 'Authenticate' })).not.toBeNull();
    });

    it('shows a toast when authorizing fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const toast = vi.fn();
        mocks.getProviderStatus.mockResolvedValueOnce({ authenticated: false });
        mocks.authorize.mockRejectedValueOnce(
            Object.assign(outage(), { original_message: 'OAuth server unavailable' }),
        );
        renderWithProviders(
            <ToastContext.Provider value={toast}>
                <OAuthProviderConnectButton oauthProviderId="provider" />
            </ToastContext.Provider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Authenticate' }));

        await waitFor(() =>
            expect(toast).toHaveBeenCalledWith({
                status: 'error',
                title: 'Could not connect',
                description: 'OAuth server unavailable',
            }),
        );
    });
});

describe('RemoteMcpConnectionButton', () => {
    it('does not offer Connect when its own status check got no answer', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.getCollectionStatus.mockRejectedValueOnce(outage());
        renderWithProviders(<RemoteMcpConnectionButton appId="app" collectionId="jira" variant="compact" />);

        expect(await screen.findByRole('button', { name: 'Status unknown. Retry' })).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    });

    it('tells the parent once a retry answers, so a waiting agent can resume', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const onAuthChange = vi.fn();
        mocks.getCollectionStatus.mockRejectedValueOnce(outage());
        renderWithProviders(<RemoteMcpConnectionButton appId="app" collectionId="jira" onAuthChange={onAuthChange} />);

        const retry = await screen.findByRole('button', { name: 'Status unknown. Retry' });
        expect(onAuthChange).not.toHaveBeenCalled();

        mocks.getCollectionStatus.mockResolvedValueOnce(collectionStatus(true));
        fireEvent.click(retry);

        expect(await screen.findByText('Connected')).not.toBeNull();
        expect(onAuthChange).toHaveBeenCalledTimes(1);
    });

    it('keeps the state unknown and stays quiet when a retry also fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const onAuthChange = vi.fn();
        mocks.getCollectionStatus.mockRejectedValue(outage());
        renderWithProviders(<RemoteMcpConnectionButton appId="app" collectionId="jira" onAuthChange={onAuthChange} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Status unknown. Retry' }));

        await waitFor(() => expect(mocks.getCollectionStatus).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole('button', { name: 'Status unknown. Retry' })).not.toBeNull();
        expect(onAuthChange).not.toHaveBeenCalled();
        mocks.getCollectionStatus.mockReset();
    });

    it('shows read-only views as unknown, not as not connected', () => {
        renderWithProviders(
            <RemoteMcpConnectionButton appId="app" collectionId="jira" variant="compact" statusUnavailable readOnly />,
        );

        expect(screen.getByText('Status unknown')).not.toBeNull();
        expect(screen.queryByText('Not connected')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('trusts an answer from the parent over an earlier failed lookup', () => {
        renderWithProviders(
            <RemoteMcpConnectionButton appId="app" collectionId="jira" authenticated={false} statusUnavailable />,
        );

        expect(screen.getByRole('button', { name: 'Connect' })).not.toBeNull();
    });

    it('reports a failed popup through onError when the parent provides it', async () => {
        const onError = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderWithProviders(
            <RemoteMcpConnectionButton
                appId="app"
                collectionId="jira"
                collectionName="Jira"
                authenticated={false}
                onError={onError}
            />,
        );

        mocks.popupError?.('Authorization denied');

        await waitFor(() => expect(onError).toHaveBeenCalledWith('Jira: Authorization denied'));
    });

    it('shows a toast for a failed disconnect when the parent gives no onError', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const toast = vi.fn();
        mocks.disconnect.mockRejectedValueOnce(outage());
        renderWithProviders(
            <ToastContext.Provider value={toast}>
                <RemoteMcpConnectionButton
                    appId="app"
                    collectionId="jira"
                    collectionName="Jira"
                    authenticated
                    variant="compact"
                    showDisconnect
                />
            </ToastContext.Provider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

        await waitFor(() =>
            expect(toast).toHaveBeenCalledWith({
                status: 'error',
                title: 'Could not disconnect',
                description: 'Jira: Service Unavailable',
            }),
        );
    });
});
