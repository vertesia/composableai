import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { McpConnectionsActionMenu, McpConnectionsInlineList } from './McpConnectionsButton.js';

const mocks = vi.hoisted(() => ({
    getCollectionStatus: vi.fn(),
    getInstalledApps: vi.fn(),
    getStatus: vi.fn(),
}));

const mockClient = {
    apps: {
        getInstalledApps: mocks.getInstalledApps,
    },
    remoteMcpConnections: {
        getCollectionStatus: mocks.getCollectionStatus,
        getStatus: mocks.getStatus,
    },
};

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: mockClient,
    }),
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('MCP connection controls', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows available MCP servers and their connection and availability state inline', async () => {
        mocks.getInstalledApps.mockResolvedValue([
            {
                id: 'app-1',
                manifest: {
                    name: 'mcp-app',
                    title: 'MCP App',
                    oauth_providers: {},
                    tool_collections: [
                        {
                            type: 'mcp',
                            id: 'jira',
                            name: 'Jira',
                            namespace: 'jira',
                            url: 'https://jira-mcp.example.com',
                        },
                        {
                            type: 'mcp',
                            id: 'miro',
                            name: 'Miro',
                            namespace: 'miro',
                            url: 'https://miro-mcp.example.com',
                        },
                        {
                            type: 'mcp',
                            id: 'linear',
                            name: 'Linear',
                            namespace: 'linear',
                            url: 'https://linear-mcp.example.com',
                        },
                        {
                            type: 'mcp',
                            id: 'github',
                            name: 'GitHub',
                            namespace: 'github',
                            url: 'https://github-mcp.example.com',
                        },
                    ],
                },
                oauth_collection_ids: ['jira', 'miro', 'linear', 'github'],
            },
        ]);
        mocks.getStatus.mockResolvedValue([
            {
                authenticated: true,
                collection_id: 'jira',
                collection_name: 'Jira',
                mcp_server_url: 'https://jira-mcp.example.com',
            },
            {
                authenticated: true,
                collection_id: 'miro',
                collection_name: 'Miro',
                mcp_server_url: 'https://miro-mcp.example.com',
            },
            {
                authenticated: true,
                collection_id: 'linear',
                collection_name: 'Linear',
                mcp_server_url: 'https://linear-mcp.example.com',
            },
            {
                authenticated: false,
                collection_id: 'github',
                collection_name: 'GitHub',
                mcp_server_url: 'https://github-mcp.example.com',
            },
        ]);
        const onChange = vi.fn();

        renderWithProviders(<McpConnectionsInlineList disabledCollections={['linear']} onChange={onChange} />);

        await screen.findByText('Jira');
        await waitFor(() => expect(mocks.getStatus).toHaveBeenCalledTimes(1));

        expect(screen.getByText('Miro')).not.toBeNull();
        expect(screen.getByText('Linear')).not.toBeNull();
        expect(screen.getByText('GitHub')).not.toBeNull();
        expect(screen.queryByText('Connected')).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Disconnect' })).toHaveLength(3);
        const connectButton = screen.getByRole('button', { name: 'Connect' });
        const disconnectButton = screen.getAllByRole('button', { name: 'Disconnect' })[0];
        expect(connectButton.className).toContain('w-32');
        expect(disconnectButton.className).toContain('w-32');
        expect(screen.getAllByText('Enabled')).toHaveLength(3);
        expect(screen.getByText('Disabled')).not.toBeNull();
    });

    it('renders MCP rows before connection statuses finish loading', async () => {
        const statusRequest =
            deferred<
                Array<{
                    authenticated: boolean;
                    collection_id: string;
                    collection_name: string;
                    mcp_server_url: string;
                }>
            >();
        mocks.getInstalledApps.mockResolvedValue([
            {
                id: 'app-1',
                manifest: {
                    name: 'jira-app',
                    title: 'Jira App',
                    oauth_providers: {},
                    tool_collections: [
                        {
                            type: 'mcp',
                            id: 'jira',
                            name: 'Jira',
                            namespace: 'jira',
                            url: 'https://jira-mcp.example.com',
                        },
                    ],
                },
                oauth_collection_ids: ['jira'],
            },
        ]);
        mocks.getStatus.mockReturnValue(statusRequest.promise);

        renderWithProviders(<McpConnectionsInlineList onChange={vi.fn()} />);

        expect(await screen.findByText('Jira')).not.toBeNull();
        const checkingButton = screen.getByRole('button', { name: 'Checking status' });
        expect((checkingButton as HTMLButtonElement).disabled).toBe(true);
        expect(checkingButton.className).toContain('w-32');
        expect(mocks.getCollectionStatus).not.toHaveBeenCalled();

        await act(async () => {
            statusRequest.resolve([
                {
                    authenticated: true,
                    collection_id: 'jira',
                    collection_name: 'Jira',
                    mcp_server_url: 'https://jira-mcp.example.com',
                },
            ]);
        });

        await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).not.toBeNull());
        expect(screen.queryByText('Connected')).toBeNull();
    });

    it('renders MCP in a separate slash action menu', async () => {
        mocks.getInstalledApps.mockResolvedValue([
            {
                id: 'app-1',
                manifest: {
                    name: 'jira-app',
                    title: 'Jira',
                    oauth_providers: {},
                    tool_collections: [
                        {
                            type: 'mcp',
                            id: 'jira',
                            name: 'Jira',
                            namespace: 'jira',
                            url: 'https://mcp.example.com',
                        },
                        {
                            type: 'mcp',
                            id: 'github',
                            name: 'GitHub',
                            namespace: 'github',
                            url: 'https://github-mcp.example.com',
                        },
                    ],
                },
                oauth_collection_ids: ['jira', 'github'],
            },
        ]);
        mocks.getStatus.mockResolvedValue([
            {
                authenticated: true,
                collection_id: 'jira',
                collection_name: 'Jira',
                mcp_server_url: 'https://mcp.example.com',
            },
            {
                authenticated: false,
                collection_id: 'github',
                collection_name: 'GitHub',
                mcp_server_url: 'https://github-mcp.example.com',
            },
        ]);

        renderWithProviders(<McpConnectionsActionMenu />);

        const trigger = await screen.findByRole('button', { name: /settings/i });
        await waitFor(() => expect(mocks.getStatus).toHaveBeenCalledTimes(1));
        expect(mocks.getStatus).toHaveBeenCalledWith('app-1');
        expect(trigger.textContent).toBe('/');

        fireEvent.pointerDown(trigger);

        const menuItem = await screen.findByText('MCP');
        expect(menuItem).not.toBeNull();
        expect(screen.getByText('1')).not.toBeNull();

        fireEvent.click(menuItem);

        await waitFor(() => {
            expect(screen.getByText('Manage the MCP servers available to this conversation.')).not.toBeNull();
        });
    });
});
