import { fireEvent, screen, waitFor } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { ModernAgentConversation } from './ModernAgentConversation';

const mocks = vi.hoisted(() => ({
    addOptimisticMessage: vi.fn(),
    removeOptimisticMessages: vi.fn(),
    reconnect: vi.fn(),
    restart: vi.fn(),
    sendSignal: vi.fn(),
    useAgentStream: vi.fn(),
    useAgentPlans: vi.fn(),
    useDocumentPanel: vi.fn(),
    useFileProcessing: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            agents: {
                restart: mocks.restart,
                sendSignal: mocks.sendSignal,
                getActiveWorkstreams: vi.fn().mockResolvedValue({ running: [] }),
            },
        },
        project: undefined,
        user: undefined,
    }),
}));

vi.mock('./SkillWidgetProvider', () => ({
    SkillWidgetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./ModernAgentOutput/Header', () => ({
    default: () => <div data-testid="agent-header" />,
}));

vi.mock('./ModernAgentOutput/MessageInput', () => ({
    default: ({ onSend }: { onSend: (message: string) => void }) => (
        <button type="button" onClick={() => onSend('follow up')}>
            composer send
        </button>
    ),
}));

vi.mock('./ModernAgentOutput/AllMessagesMixed', () => ({
    default: ({
        messages,
        streamingMessages,
        onSendMessage,
    }: {
        messages: AgentMessage[];
        streamingMessages: Map<string, unknown>;
        onSendMessage?: (message: string) => void;
    }) => (
        <div>
            <div data-testid="rendered-message-count">{messages.length}</div>
            <div data-testid="rendered-streaming-count">{streamingMessages.size}</div>
            <button type="button" disabled={!onSendMessage} onClick={() => onSendMessage?.('follow up')}>
                inline send
            </button>
        </div>
    ),
}));

vi.mock('./AgentRightPanel.js', () => ({
    AgentRightPanel: () => <div data-testid="agent-right-panel" />,
}));

vi.mock('./hooks/useAgentStream.js', () => ({
    useAgentStream: (...args: unknown[]) => mocks.useAgentStream(...args),
}));

vi.mock('./hooks/useAgentPlans.js', () => ({
    useAgentPlans: (...args: unknown[]) => mocks.useAgentPlans(...args),
}));

vi.mock('./hooks/useDocumentPanel.js', () => ({
    useDocumentPanel: (...args: unknown[]) => mocks.useDocumentPanel(...args),
}));

vi.mock('./hooks/useFileProcessing.js', () => ({
    useFileProcessing: (...args: unknown[]) => mocks.useFileProcessing(...args),
}));

function createMessage(type: AgentMessageType, message: string): AgentMessage {
    return {
        timestamp: Date.now(),
        workflow_run_id: 'agent-run-1',
        type,
        message,
        workstream_id: 'main',
    };
}

function mockStreamState(options: {
    messages: AgentMessage[];
    isCompleted?: boolean;
    agentRunStatus?: string | null;
    streamingMessages?: Map<string, unknown>;
}) {
    mocks.useAgentStream.mockReturnValue({
        messages: options.messages,
        streamingMessages: options.streamingMessages ?? new Map(),
        isCompleted: options.isCompleted ?? true,
        debugChunkFlash: false,
        addOptimisticMessage: mocks.addOptimisticMessage,
        removeOptimisticMessages: mocks.removeOptimisticMessages,
        reconnect: mocks.reconnect,
        agentRunStatus: options.agentRunStatus ?? null,
        workflowRunId: 'workflow-run-1',
        serverFileUpdates: new Map(),
    });
}

function renderConversation(props: Partial<React.ComponentProps<typeof ModernAgentConversation>> = {}) {
    return renderWithProviders(
        <ModernAgentConversation
            agentRunId="agent-run-1"
            title="Agent"
            hideHeader
            hideMessageInput
            showRightPanel={false}
            {...props}
        />,
    );
}

describe('ModernAgentConversation send handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.restart.mockResolvedValue({ id: 'agent-run-1' });
        mocks.sendSignal.mockResolvedValue({});
        mocks.useAgentPlans.mockReturnValue({
            plans: [],
            activePlanIndex: 0,
            setActivePlanIndex: vi.fn(),
            workstreamStatusMap: new Map(),
            showInput: true,
            showSlidingPanel: false,
            setShowSlidingPanel: vi.fn(),
        });
        mocks.useDocumentPanel.mockReturnValue({
            openDocuments: [],
            activeDocumentId: null,
            isDocPanelOpen: false,
            docRefreshKey: 0,
            closeDocPanel: vi.fn(),
            closeDocument: vi.fn(),
            selectDocument: vi.fn(),
            openDocInPanel: vi.fn(),
            updateDocumentTitle: vi.fn(),
        });
        mocks.useFileProcessing.mockReturnValue({
            processingFiles: new Map(),
            hasProcessingFiles: false,
            handleFileUpload: vi.fn(),
        });
    });

    it('restarts a terminal continuable run before sending the follow-up message', async () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.COMPLETE, 'done')],
            agentRunStatus: 'COMPLETED',
        });

        renderConversation({ onRestart: vi.fn() });

        fireEvent.click(screen.getByRole('button', { name: 'inline send' }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledTimes(1);
        });

        expect(mocks.restart).toHaveBeenCalledWith('agent-run-1');
        expect(mocks.reconnect).toHaveBeenCalledTimes(1);
        expect(mocks.sendSignal).toHaveBeenCalledWith(
            'agent-run-1',
            'UserInput',
            expect.objectContaining({
                message: 'follow up',
                metadata: expect.objectContaining({
                    _messageId: expect.any(String),
                }),
            }),
        );
        expect(mocks.restart.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendSignal.mock.invocationCallOrder[0]);
        expect(mocks.reconnect.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendSignal.mock.invocationCallOrder[0]);
    });

    it('does not restart or send from a terminal run that cannot continue', () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.COMPLETE, 'done')],
            agentRunStatus: 'COMPLETED',
        });

        renderConversation();

        fireEvent.click(screen.getByRole('button', { name: 'inline send' }));

        expect(mocks.restart).not.toHaveBeenCalled();
        expect(mocks.sendSignal).not.toHaveBeenCalled();
        expect(mocks.addOptimisticMessage).not.toHaveBeenCalled();
    });

    it('sends directly without restart while the run is active', async () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ onRestart: vi.fn() });

        fireEvent.click(screen.getByRole('button', { name: 'inline send' }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledTimes(1);
        });

        expect(mocks.restart).not.toHaveBeenCalled();
        expect(mocks.reconnect).not.toHaveBeenCalled();
        expect(mocks.sendSignal).toHaveBeenCalledWith(
            'agent-run-1',
            'UserInput',
            expect.objectContaining({ message: 'follow up' }),
        );
    });

    it('test playback controls slice rendered messages without mutating the live stream', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'first question'),
                createMessage(AgentMessageType.ANSWER, 'first answer'),
                createMessage(AgentMessageType.QUESTION, 'second question'),
                createMessage(AgentMessageType.ANSWER, 'second answer'),
                createMessage(AgentMessageType.COMPLETE, 'done'),
            ],
            streamingMessages: new Map([
                [
                    'stream-1',
                    {
                        text: 'live stream',
                        startTimestamp: Date.now(),
                    },
                ],
            ]),
        });

        renderConversation({ enableTestPlayback: true });

        expect(screen.getByTestId('rendered-message-count').textContent).toBe('5');
        expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('1');

        fireEvent.click(screen.getByRole('button', { name: 'Previous user turn' }));

        expect(screen.getByTestId('rendered-message-count').textContent).toBe('3');
        expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('0');

        fireEvent.click(screen.getByRole('button', { name: 'Previous message' }));

        expect(screen.getByTestId('rendered-message-count').textContent).toBe('2');

        fireEvent.click(screen.getByRole('button', { name: 'Jump to live' }));

        expect(screen.getByTestId('rendered-message-count').textContent).toBe('5');
        expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('1');
    });
});
