import { fireEvent, screen } from '@testing-library/react';
import { AgentMessageType } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { AgentRequestInputOverlay } from './AgentRequestInputOverlay';
import type { RequestInputMessageWithUx } from './ModernAgentOutput/requestInputMessages';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            remoteMcpConnections: {
                getCollectionStatus: vi.fn(),
            },
        },
    }),
}));

vi.mock('../../oauth/RemoteMcpConnectionButton.js', () => ({
    RemoteMcpConnectionButton: () => <button type="button">Connect</button>,
}));

function createMcpRequestMessage(): RequestInputMessageWithUx {
    return {
        type: AgentMessageType.REQUEST_INPUT,
        timestamp: 1,
        workflow_run_id: 'run-1',
        workstream_id: 'main',
        message: 'Connect to Jira to continue.',
        details: {
            ux: {
                mcp_connect: {
                    app_install_id: 'app1',
                    collection_id: 'jira',
                    name: 'Jira',
                },
            },
        },
    };
}

describe('AgentRequestInputOverlay', () => {
    it('lets the user decline an MCP connection request', () => {
        const onSendMessage = vi.fn();

        renderWithProviders(
            <AgentRequestInputOverlay message={createMcpRequestMessage()} onSendMessage={onSendMessage} />,
        );

        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Connect', 'Decline']);

        fireEvent.click(screen.getByRole('button', { name: /decline/i }));

        expect(onSendMessage).toHaveBeenCalledTimes(1);
        expect(onSendMessage).toHaveBeenCalledWith("I don't want to connect to Jira. Continue without it.");
    });
});
