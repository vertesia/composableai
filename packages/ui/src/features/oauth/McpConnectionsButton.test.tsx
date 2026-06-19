import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { McpConnectionsActionMenu } from './McpConnectionsButton.js';

const mocks = vi.hoisted(() => ({
    getInstalledApps: vi.fn(),
    getStatus: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            apps: {
                getInstalledApps: mocks.getInstalledApps,
            },
            remoteMcpConnections: {
                getStatus: mocks.getStatus,
            },
        },
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
                    ],
                },
                oauth_collection_ids: ['jira'],
            },
        ]);
        mocks.getStatus.mockResolvedValue([
            {
                authenticated: true,
                collection_id: 'jira',
                collection_name: 'Jira',
                mcp_server_url: 'https://mcp.example.com',
            },
        ]);

        renderWithProviders(<McpConnectionsActionMenu />);

        const trigger = await screen.findByRole('button', { name: /settings/i });
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
