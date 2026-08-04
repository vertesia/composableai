import { fireEvent, screen, waitFor } from '@testing-library/react';
import { AgentMessageType } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { AgentRequestInputOverlay } from './AgentRequestInputOverlay';
import type { RequestInputMessageWithUx } from './ModernAgentOutput/requestInputMessages';

const mocks = vi.hoisted(() => ({
    getCollectionStatus: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            remoteMcpConnections: {
                getCollectionStatus: mocks.getCollectionStatus,
            },
        },
    }),
}));

vi.mock('../../oauth/RemoteMcpConnectionButton.js', () => ({
    RemoteMcpConnectionButton: ({ onAuthChange }: { onAuthChange: () => void }) => (
        <button type="button" onClick={onAuthChange}>
            Connect
        </button>
    ),
}));

function createMcpRequestMessage(): RequestInputMessageWithUx {
    return {
        type: AgentMessageType.REQUEST_INPUT,
        timestamp: 1,
        workflow_run_id: 'run-1',
        workstream_id: 'main',
        message: 'Connect to Jira to continue.',
        details: {
            request_id: 'request-mcp-1',
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
            request_id: 'write_artifact:name:quotes.md',
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
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCollectionStatus.mockResolvedValue({ authenticated: true });
    });

    it('lets the user decline an MCP connection request', () => {
        const onSendMessage = vi.fn();

        renderWithProviders(
            <AgentRequestInputOverlay message={createMcpRequestMessage()} onSendMessage={onSendMessage} />,
        );

        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Connect', 'Decline']);

        fireEvent.click(screen.getByRole('button', { name: /decline/i }));

        expect(onSendMessage).toHaveBeenCalledTimes(1);
        expect(onSendMessage).toHaveBeenCalledWith("I don't want to connect to Jira. Continue without it.", {
            request_input_response: { request_id: 'request-mcp-1' },
        });
    });

    it('correlates a successful MCP connection response', async () => {
        const onMcpConnected = vi.fn();

        renderWithProviders(
            <AgentRequestInputOverlay
                message={createMcpRequestMessage()}
                onSendMessage={vi.fn()}
                onMcpConnected={onMcpConnected}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

        await waitFor(() => {
            expect(onMcpConnected).toHaveBeenCalledWith(expect.objectContaining({ collection_id: 'jira' }), {
                request_input_response: { request_id: 'request-mcp-1' },
            });
        });
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
            request_input_response: {
                request_id: 'write_artifact:name:quotes.md',
            },
        });
    });

    it('sends a tool approval option with structured metadata', () => {
        const onSendMessage = vi.fn();

        renderWithProviders(
            <AgentRequestInputOverlay message={createToolApprovalRequestMessage()} onSendMessage={onSendMessage} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Allow this action for this run' }));

        expect(onSendMessage).toHaveBeenCalledTimes(1);
        expect(onSendMessage).toHaveBeenCalledWith('allow_for_run', {
            tool_approval_response: {
                decision: 'allow_for_run',
                approval_key: 'write_artifact:name:quotes.md',
            },
            request_input_response: {
                request_id: 'write_artifact:name:quotes.md',
            },
        });
    });

    it('sends a bare option id for prompts that are not tool approvals', () => {
        const onSendMessage = vi.fn();
        const message = createToolApprovalRequestMessage();
        delete (message.details as Record<string, unknown>).tool_approval;

        renderWithProviders(<AgentRequestInputOverlay message={message} onSendMessage={onSendMessage} />);

        fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));

        expect(onSendMessage).toHaveBeenCalledTimes(1);
        expect(onSendMessage).toHaveBeenCalledWith('allow_once', {
            request_input_response: { request_id: 'write_artifact:name:quotes.md' },
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
