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

function createToolApprovalRequestMessage(): RequestInputMessageWithUx {
    return {
        type: AgentMessageType.REQUEST_INPUT,
        timestamp: 1,
        workflow_run_id: 'run-1',
        workstream_id: 'main',
        message: 'Approve Write Artifact: quotes.md?',
        details: {
            tool_approval: {
                tool_name: 'write_artifact',
                tool_title: 'Write Artifact',
                target: 'name:quotes.md',
                approval_key: 'write_artifact:name:quotes.md',
            },
            ux: {
                options: [
                    { id: 'allow_once', label: 'Allow once' },
                    { id: 'allow_for_run', label: 'Allow this action for this run' },
                    { id: 'deny', label: 'Deny' },
                ],
                free_response: {
                    placeholder: 'No, and tell the agent what to do differently',
                    submit_label: 'Submit',
                    metadata: {
                        tool_approval_response: {
                            decision: 'deny_with_feedback',
                            approval_key: 'write_artifact:name:quotes.md',
                        },
                    },
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

    it('sends a commented tool approval denial with structured metadata', () => {
        const onSendMessage = vi.fn();

        renderWithProviders(
            <AgentRequestInputOverlay message={createToolApprovalRequestMessage()} onSendMessage={onSendMessage} />,
        );

        fireEvent.change(screen.getByPlaceholderText('No, and tell the agent what to do differently'), {
            target: { value: 'Do not write a file. Put the summary in chat.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(onSendMessage).toHaveBeenCalledTimes(1);
        expect(onSendMessage).toHaveBeenCalledWith('Do not write a file. Put the summary in chat.', {
            tool_approval_response: {
                decision: 'deny_with_feedback',
                approval_key: 'write_artifact:name:quotes.md',
            },
        });
    });

    it('renders legacy field-prefixed tool approval prompts with a friendly target', () => {
        const message = createToolApprovalRequestMessage();
        message.message = 'Approve Write Artifact: name quotes.md?';

        renderWithProviders(<AgentRequestInputOverlay message={message} onSendMessage={vi.fn()} />);

        expect(screen.getByText('Approve Write Artifact: quotes.md?')).not.toBeNull();
        expect(screen.queryByText('Approve Write Artifact: name quotes.md?')).toBeNull();
    });
});
