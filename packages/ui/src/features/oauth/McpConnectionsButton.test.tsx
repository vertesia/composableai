import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { McpConnectionsActionMenu } from './McpConnectionsButton.js';

const mocks = vi.hoisted(() => ({
    getInstalledApps: vi.fn(),
    getStatus: vi.fn(),
}));

const mockClient = {
    apps: {
        getInstalledApps: mocks.getInstalledApps,
    },
    remoteMcpConnections: {
        getStatus: mocks.getStatus,
    },
};

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: mockClient,
    }),
}));

describe('McpConnectionsActionMenu', () => {
    afterEach(() => {
        vi.clearAllMocks();
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
