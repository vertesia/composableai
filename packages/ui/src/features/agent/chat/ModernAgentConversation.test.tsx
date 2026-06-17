import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { ModernAgentConversation } from './ModernAgentConversation';

const mocks = vi.hoisted(() => ({
    addOptimisticMessage: vi.fn(),
    updateOptimisticMessageStatus: vi.fn(),
    removeOptimisticMessages: vi.fn(),
    reconnect: vi.fn(),
    restart: vi.fn(),
    sendSignal: vi.fn(),
    headerProps: vi.fn(),
    allMessagesMixedProps: vi.fn(),
    messageInputProps: vi.fn(),
    rightPanelProps: vi.fn(),
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
    default: (props: {
        onExportFixture?: () => void;
        showPlaybackButton?: boolean;
        isPlaybackEnabled?: boolean;
        onTogglePlayback?: () => void;
    }) => {
        mocks.headerProps(props);
        return <div data-testid="agent-header" />;
    },
}));

vi.mock('./ModernAgentOutput/MessageInput', () => ({
    default: (props: {
        onSend: (message: string) => void;
        activeTaskCount?: number;
        activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        isCompleted?: boolean;
        isStreaming?: boolean;
    }) => {
        mocks.messageInputProps(props);
        return (
            <button type="button" onClick={() => props.onSend('follow up')}>
                composer send
            </button>
        );
    },
}));

vi.mock('./ModernAgentOutput/AllMessagesMixed', () => ({
    default: ({
        messages,
        streamingMessages,
        bottomRef,
        onSendMessage,
        renderRequestInputControls,
    }: {
        messages: AgentMessage[];
        streamingMessages: Map<string, unknown>;
        bottomRef: React.RefObject<HTMLDivElement>;
        onSendMessage?: (message: string) => void;
        renderRequestInputControls?: boolean;
    }) => {
        mocks.allMessagesMixedProps({ messages, streamingMessages, onSendMessage, renderRequestInputControls });
        return (
            <div>
                <div data-testid="rendered-message-count">{messages.length}</div>
                <div data-testid="rendered-streaming-count">{streamingMessages.size}</div>
                <button type="button" disabled={!onSendMessage} onClick={() => onSendMessage?.('follow up')}>
                    inline send
                </button>
                <div ref={bottomRef} data-testid="bottom-sentinel" />
            </div>
        );
    },
}));

vi.mock('./AgentRightPanel.js', () => ({
    AgentRightPanel: (props: { activeWorkstreams?: Array<{ workstream_id: string; status: string }> }) => {
        mocks.rightPanelProps(props);
        return <div data-testid="agent-right-panel" />;
    },
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
        updateOptimisticMessageStatus: mocks.updateOptimisticMessageStatus,
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
            removeProcessingFile: vi.fn(),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
                client_message_id: expect.any(String),
                metadata: expect.objectContaining({
                    id: expect.any(String),
                    _messageId: expect.any(String),
                }),
            }),
        );
        expect(mocks.restart.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendSignal.mock.invocationCallOrder[0]);
        expect(mocks.reconnect.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendSignal.mock.invocationCallOrder[0]);
        expect(mocks.updateOptimisticMessageStatus).toHaveBeenCalledWith(expect.any(String), 'received');
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

    it('shows the composer for a restart-capable terminal run even when the host hides normal input', () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.COMPLETE, 'done')],
            agentRunStatus: 'COMPLETED',
        });
        mocks.useAgentPlans.mockReturnValue({
            plans: [],
            activePlanIndex: 0,
            setActivePlanIndex: vi.fn(),
            workstreamStatusMap: new Map(),
            showInput: false,
            showSlidingPanel: false,
            setShowSlidingPanel: vi.fn(),
        });

        renderConversation({ interactive: false, onRestart: vi.fn() });

        expect(screen.getByRole('button', { name: 'composer send' })).not.toBeNull();
    });

    it('keeps the composer hidden for active non-interactive runs when the host hides input', () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            agentRunStatus: 'RUNNING',
        });
        mocks.useAgentPlans.mockReturnValue({
            plans: [],
            activePlanIndex: 0,
            setActivePlanIndex: vi.fn(),
            workstreamStatusMap: new Map(),
            showInput: false,
            showSlidingPanel: false,
            setShowSlidingPanel: vi.fn(),
        });

        renderConversation({ interactive: false, onRestart: vi.fn() });

        expect(screen.queryByRole('button', { name: 'composer send' })).toBeNull();
    });

    it('unlocks the composer when an idle marker arrives before the stream completion flag updates', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'What are the news headlines in Japan today?'),
                createMessage(AgentMessageType.THOUGHT, 'Searching for the latest news headlines from Japan...'),
                createMessage(AgentMessageType.ANSWER, 'Here are the top news headlines from Japan today.'),
                createMessage(AgentMessageType.IDLE, 'Waiting for your command...'),
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            isCompleted?: boolean;
            isStreaming?: boolean;
        };

        expect(latestMessageInputProps.isCompleted).toBe(true);
        expect(latestMessageInputProps.isStreaming).toBe(false);
    });

    it('uses message-derived active workstreams for the composer count and right panel fallback', async () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                { ...createMessage(AgentMessageType.ANSWER, 'alpha update'), workstream_id: 'alpha' },
                { ...createMessage(AgentMessageType.ANSWER, 'beta update'), workstream_id: 'beta' },
                { ...createMessage(AgentMessageType.COMPLETE, 'gamma done'), workstream_id: 'gamma' },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            hideMessageInput: false,
            hideWorkstreamTabs: false,
            showRightPanel: true,
        });

        await waitFor(() => {
            expect(mocks.rightPanelProps).toHaveBeenCalled();
        });

        const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
            activeTab?: string;
        };
        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            activeTaskCount?: number;
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        };

        expect(latestRightPanelProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'alpha', status: 'running' }),
            expect.objectContaining({ workstream_id: 'beta', status: 'running' }),
        ]);
        expect(latestRightPanelProps.activeTab).toBe('plan');
        expect(latestMessageInputProps.activeTaskCount).toBe(2);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'alpha', status: 'running' }),
            expect.objectContaining({ workstream_id: 'beta', status: 'running' }),
        ]);
    });

    it('does not count completed workstream lifecycle messages as active in the composer fallback', async () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Workstream "qa_tasks" launched'),
                    workstream_id: 'qa_tasks',
                    details: {
                        workstream_event: 'launched',
                        workstream_id: 'qa_tasks',
                        launch_id: 'launch-qa-tasks',
                    },
                },
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Workstream "qa_tasks" completed'),
                    workstream_id: 'qa_tasks',
                    details: {
                        workstream_event: 'completed',
                        workstream_id: 'qa_tasks',
                        launch_id: 'launch-qa-tasks',
                        status: 'completed',
                    },
                },
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Workstream "qa_assignee" launched'),
                    workstream_id: 'qa_assignee',
                    details: {
                        workstream_event: 'launched',
                        workstream_id: 'qa_assignee',
                        launch_id: 'launch-qa-assignee',
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            hideMessageInput: false,
            hideWorkstreamTabs: false,
            showRightPanel: true,
        });

        await waitFor(() => {
            expect(mocks.rightPanelProps).toHaveBeenCalled();
        });

        const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        };
        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            activeTaskCount?: number;
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        };

        expect(latestRightPanelProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'qa_assignee', status: 'running' }),
        ]);
        expect(latestMessageInputProps.activeTaskCount).toBe(1);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'qa_assignee', status: 'running' }),
        ]);
    });

    it('keeps launched workstreams active when their child transcript emits JSON results', async () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(
                        AgentMessageType.UPDATE,
                        'Workstream "ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6" launched',
                    ),
                    workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                    details: {
                        workstream_event: 'launched',
                        workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                        launch_id: 'launch-image',
                        interaction: 'ImageGeneratorAgent',
                    },
                },
                {
                    ...createMessage(
                        AgentMessageType.COMPLETE,
                        '{\n  "generated_images": ["store:65dbb885-d76f-431a-a01e-0511d70730a5"]\n}',
                    ),
                    workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                    details: {
                        event_class: 'user_content',
                        streamed: true,
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            hideMessageInput: false,
            hideWorkstreamTabs: false,
            showRightPanel: true,
        });

        await waitFor(() => {
            expect(mocks.rightPanelProps).toHaveBeenCalled();
        });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            activeTaskCount?: number;
            activeWorkstreams?: Array<{ workstream_id: string; status: string; interaction?: string }>;
        };

        expect(latestMessageInputProps.activeTaskCount).toBe(1);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([
            expect.objectContaining({
                workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                interaction: 'ImageGeneratorAgent',
                status: 'running',
            }),
        ]);
    });

    it('shows a bottom request overlay for pending ask input even when normal input is hidden', async () => {
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.REQUEST_INPUT, 'What is your favorite color?'),
                    details: {
                        ux: {
                            options: [
                                { id: 'red', label: 'Red' },
                                { id: 'blue', label: 'Blue' },
                            ],
                        },
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation();

        expect(screen.queryByRole('button', { name: 'composer send' })).toBeNull();
        expect(screen.getByText('What is your favorite color?')).not.toBeNull();
        expect(screen.getByRole('button', { name: /Blue/ })).not.toBeNull();
        expect(mocks.allMessagesMixedProps.mock.lastCall?.[0]).toEqual(
            expect.objectContaining({ renderRequestInputControls: false }),
        );

        fireEvent.click(screen.getByRole('button', { name: /Blue/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledTimes(1);
        });
        expect(mocks.sendSignal).toHaveBeenCalledWith(
            'agent-run-1',
            'UserInput',
            expect.objectContaining({
                message: 'blue',
                client_message_id: expect.any(String),
                metadata: expect.objectContaining({
                    id: expect.any(String),
                    _messageId: expect.any(String),
                }),
            }),
        );
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

    it('marks a sent message as sending and then received', async () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ onRestart: vi.fn() });

        fireEvent.click(screen.getByRole('button', { name: 'inline send' }));

        const optimisticMessage = mocks.addOptimisticMessage.mock.calls[0]?.[0] as AgentMessage | undefined;
        expect(optimisticMessage).toEqual(
            expect.objectContaining({
                type: AgentMessageType.QUESTION,
                message: 'follow up',
                details: expect.objectContaining({
                    _optimistic: true,
                    _messageId: expect.any(String),
                    _deliveryStatus: 'sending',
                }),
            }),
        );

        await waitFor(() => {
            expect(mocks.updateOptimisticMessageStatus).toHaveBeenCalledWith(
                optimisticMessage?.details?._messageId,
                'received',
            );
        });
    });

    it('marks a failed send without removing the optimistic message', async () => {
        mocks.sendSignal.mockRejectedValueOnce(new Error('signal failed'));
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ onRestart: vi.fn() });

        fireEvent.click(screen.getByRole('button', { name: 'inline send' }));

        const optimisticMessage = mocks.addOptimisticMessage.mock.calls[0]?.[0] as AgentMessage | undefined;

        await waitFor(() => {
            expect(mocks.updateOptimisticMessageStatus).toHaveBeenCalledWith(
                optimisticMessage?.details?._messageId,
                'failed',
            );
        });
        expect(mocks.removeOptimisticMessages).not.toHaveBeenCalled();
    });

    it('playback controls slice rendered messages and scroll forward without mutating the live stream', async () => {
        const originalScrollIntoView = Element.prototype.scrollIntoView;
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

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

        try {
            renderConversation({ enablePlayback: true });

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('5');
            expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('1');

            fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('1');
            expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('0');
            expect(scrollIntoView).not.toHaveBeenCalled();

            const playbackPositionInput = screen.getByRole('textbox', { name: 'Playback position' });
            fireEvent.change(playbackPositionInput, {
                target: { value: '3' },
            });
            fireEvent.blur(playbackPositionInput, {
                target: { value: '3' },
            });

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('3');
            await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
            scrollIntoView.mockClear();

            fireEvent.click(screen.getByRole('button', { name: 'Previous message' }));

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('2');
            expect(scrollIntoView).not.toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: 'Jump to latest message' }));

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('5');
            expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('0');
            await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
            scrollIntoView.mockClear();

            fireEvent.click(screen.getByRole('button', { name: 'Jump to live' }));

            expect(screen.getByTestId('rendered-message-count').textContent).toBe('5');
            expect(screen.getByTestId('rendered-streaming-count').textContent).toBe('1');
            await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
        } finally {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
    });

    it('hides the composer while viewing rewound playback history', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'first question'),
                createMessage(AgentMessageType.ANSWER, 'first answer'),
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ enablePlayback: true, hideMessageInput: false });

        expect(screen.getByRole('button', { name: 'composer send' })).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

        expect(screen.queryByRole('button', { name: 'composer send' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Jump to live' }));

        expect(screen.getByRole('button', { name: 'composer send' })).not.toBeNull();
    });

    it('exposes a local header toggle for playback controls', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'first question'),
                createMessage(AgentMessageType.ANSWER, 'first answer'),
            ],
        });

        renderConversation({ hideHeader: false, showPlaybackToggle: true });

        const calls = mocks.headerProps.mock.calls;
        const headerProps = calls[calls.length - 1][0] as {
            showPlaybackButton?: boolean;
            isPlaybackEnabled?: boolean;
            onTogglePlayback?: () => void;
        };

        expect(headerProps.showPlaybackButton).toBe(true);
        expect(headerProps.isPlaybackEnabled).toBe(false);
        expect(screen.queryByTestId('agent-test-playback-controls')).toBeNull();

        act(() => {
            headerProps.onTogglePlayback?.();
        });

        expect(screen.getByTestId('agent-test-playback-controls')).toBeTruthy();
        expect(mocks.headerProps).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isPlaybackEnabled: true,
            }),
        );
    });

    it('keeps the replay fixture export action available while messages are empty', () => {
        mockStreamState({
            messages: [],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideHeader: false });

        expect(mocks.headerProps).toHaveBeenCalledWith(
            expect.objectContaining({
                onExportFixture: expect.any(Function),
            }),
        );
    });
});
