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
    getActiveWorkstreams: vi.fn(),
    retrieve: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            agents: {
                restart: mocks.restart,
                sendSignal: mocks.sendSignal,
                getActiveWorkstreams: mocks.getActiveWorkstreams,
                retrieve: mocks.retrieve,
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
        placeholder?: string;
        contextWindowUsage?: {
            usedTokens: number;
            checkpointTokens: number;
            usedPercent: number;
            remainingPercent: number;
        };
        onCompactContext?: () => void;
        isCompactingContext?: boolean;
        approvalModeSlot?: React.ReactNode;
    }) => {
        mocks.messageInputProps(props);
        return (
            <div>
                {props.approvalModeSlot}
                <button type="button" onClick={() => props.onSend('follow up')}>
                    composer send
                </button>
            </div>
        );
    },
}));

vi.mock('./ModernAgentOutput/AllMessagesMixed', () => ({
    default: ({
        messages,
        streamingMessages,
        isCompleted,
        bottomRef,
        onSendMessage,
        showInitialRequest,
        renderRequestInputControls,
        activeWorkstream,
        onActiveWorkstreamChange,
    }: {
        messages: AgentMessage[];
        streamingMessages: Map<string, unknown>;
        isCompleted?: boolean;
        bottomRef: React.RefObject<HTMLDivElement>;
        onSendMessage?: (message: string, metadata?: Record<string, unknown>) => void;
        showInitialRequest?: boolean;
        renderRequestInputControls?: boolean;
        activeWorkstream?: string;
        onActiveWorkstreamChange?: (workstreamId: string) => void;
    }) => {
        mocks.allMessagesMixedProps({
            messages,
            streamingMessages,
            isCompleted,
            onSendMessage,
            showInitialRequest,
            renderRequestInputControls,
            activeWorkstream,
            onActiveWorkstreamChange,
        });
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
    initialHistoryStatus?: 'loading' | 'empty' | 'has_messages' | 'error';
    agentRunStatus?: string | null;
    streamingMessages?: Map<string, unknown>;
}) {
    mocks.useAgentStream.mockReturnValue({
        messages: options.messages,
        streamingMessages: options.streamingMessages ?? new Map(),
        isCompleted: options.isCompleted ?? true,
        initialHistoryStatus: options.initialHistoryStatus ?? 'has_messages',
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

function latestAllMessagesMixedProps() {
    const calls = mocks.allMessagesMixedProps.mock.calls;
    return calls[calls.length - 1]?.[0] as
        | {
              messages: AgentMessage[];
              streamingMessages: Map<string, unknown>;
              isCompleted?: boolean;
              showInitialRequest?: boolean;
              activeWorkstream?: string;
              onActiveWorkstreamChange?: (workstreamId: string) => void;
          }
        | undefined;
}

describe('ModernAgentConversation send handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.restart.mockResolvedValue({ id: 'agent-run-1' });
        mocks.sendSignal.mockResolvedValue({});
        mocks.getActiveWorkstreams.mockResolvedValue({ running: [] });
        mocks.retrieve.mockResolvedValue({ disabled_mcp_collections: undefined });
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

    it('passes the selected approval mode when starting a new interactive run', async () => {
        const startWorkflow = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(
            <ModernAgentConversation startWorkflow={startWorkflow} hideHeader hideFileUpload initialMessage="" />,
        );

        const selector = screen.getByRole('button', { name: 'Agent approval mode' });
        expect(selector.getAttribute('title')).toBeNull();

        fireEvent.pointerDown(selector, {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Approve for me/ }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft the release notes' } });
        fireEvent.click(screen.getByRole('button', { name: 'Start Agent' }));

        await waitFor(() => {
            expect(startWorkflow).toHaveBeenCalledWith('Draft the release notes', {
                tool_approval_mode: 'auto_review',
            });
        });
    });

    it('signals approval mode changes for an active interactive run', async () => {
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        await waitFor(() => {
            expect(screen.getByText('Ask for approval')).not.toBeNull();
        });
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Agent approval mode' }), {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Approve for me/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'ToolApprovalModeChanged', {
                mode: 'auto_review',
            });
        });
    });

    it('switches to full control without a confirmation modal', async () => {
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        await waitFor(() => {
            expect(screen.getByText('Ask for approval')).not.toBeNull();
        });
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Agent approval mode' }), {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Full control/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'ToolApprovalModeChanged', {
                mode: 'full_control',
            });
        });
        expect(screen.queryByText('Switch to full control?')).toBeNull();
    });

    it('orders a follow-up user message after an in-flight approval mode change', async () => {
        let resolveModeSignal: (() => void) | undefined;
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mocks.sendSignal.mockImplementation((_runId: string, signalName: string) => {
            if (signalName === 'ToolApprovalModeChanged') {
                return new Promise<void>((resolve) => {
                    resolveModeSignal = resolve;
                });
            }
            return Promise.resolve({});
        });
        mockStreamState({
            messages: [createMessage(AgentMessageType.REQUEST_INPUT, 'What should I do next?')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        const selector = await screen.findByRole('button', { name: 'Agent approval mode' });
        fireEvent.pointerDown(selector, {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Full control/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'ToolApprovalModeChanged', {
                mode: 'full_control',
            });
            expect(resolveModeSignal).toBeDefined();
        });

        fireEvent.click(screen.getByRole('button', { name: 'composer send' }));

        expect(mocks.sendSignal.mock.calls.some((call) => call[1] === 'UserInput')).toBe(false);

        await act(async () => {
            resolveModeSignal?.();
        });

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith(
                'agent-run-1',
                'UserInput',
                expect.objectContaining({ message: 'follow up' }),
            );
        });

        const modeCallIndex = mocks.sendSignal.mock.calls.findIndex((call) => call[1] === 'ToolApprovalModeChanged');
        const userInputCallIndex = mocks.sendSignal.mock.calls.findIndex((call) => call[1] === 'UserInput');
        expect(modeCallIndex).toBeGreaterThanOrEqual(0);
        expect(userInputCallIndex).toBeGreaterThan(modeCallIndex);
    });

    it('keeps a local approval mode change when stale run metadata loads later', async () => {
        let resolveRetrieve: (run: {
            tool_approval_mode: 'ask';
            interactive: true;
            disabled_mcp_collections: undefined;
        }) => void = () => {};
        mocks.retrieve.mockReturnValue(
            new Promise((resolve) => {
                resolveRetrieve = resolve;
            }),
        );
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            hideMessageInput: false,
            interactive: true,
            allowWorkflowControl: true,
            initialToolApprovalMode: 'ask',
        });

        expect(await screen.findByText('Ask for approval')).not.toBeNull();
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Agent approval mode' }), {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Full control/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'ToolApprovalModeChanged', {
                mode: 'full_control',
            });
        });

        resolveRetrieve({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });

        await waitFor(() => {
            expect(screen.getByText('Full control')).not.toBeNull();
        });
    });

    it('reverts the local approval mode when the change signal fails', async () => {
        let rejectSignal: (error: Error) => void = () => {};
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mocks.sendSignal.mockReturnValueOnce(
            new Promise((_resolve, reject) => {
                rejectSignal = reject;
            }),
        );
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        const selector = await screen.findByRole('button', { name: 'Agent approval mode' });
        expect(selector.textContent).toContain('Ask for approval');
        fireEvent.pointerDown(selector, {
            button: 0,
            ctrlKey: false,
        });
        fireEvent.click(await screen.findByRole('menuitemradio', { name: /Full control/ }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'ToolApprovalModeChanged', {
                mode: 'full_control',
            });
            expect(selector.textContent).toContain('Full control');
        });

        rejectSignal(new Error('Signal failed'));

        await waitFor(() => {
            expect(selector.textContent).toContain('Ask for approval');
        });
    });

    it('does not show a full-control fallback before active run mode metadata loads', () => {
        mocks.retrieve.mockReturnValue(new Promise(() => {}));
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'still running')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        expect(screen.queryByRole('button', { name: 'Agent approval mode' })).toBeNull();
        expect(screen.queryByText('Full control')).toBeNull();
    });

    it('disables the active-run approval selector when a run is completed', async () => {
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mockStreamState({
            messages: [createMessage(AgentMessageType.COMPLETE, 'done')],
            isCompleted: true,
            agentRunStatus: 'COMPLETED',
        });

        renderConversation({
            hideMessageInput: false,
            interactive: true,
            allowWorkflowControl: true,
            onRestart: vi.fn(),
        });

        const selector = await screen.findByRole('button', { name: 'Agent approval mode' });
        expect((selector as HTMLButtonElement).disabled).toBe(true);
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
        mocks.sendSignal.mockReturnValue(new Promise(() => {}));

        renderConversation({ hideMessageInput: false });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            isCompleted?: boolean;
            isStreaming?: boolean;
        };

        expect(latestMessageInputProps.isCompleted).toBe(true);
        expect(latestMessageInputProps.isStreaming).toBe(false);
    });

    it('keeps live run controls enabled while the agent is idle waiting for user input', async () => {
        mocks.retrieve.mockResolvedValue({
            tool_approval_mode: 'ask',
            interactive: true,
            disabled_mcp_collections: undefined,
        });
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'Planning the next tool call'),
                    details: {
                        token_usage: {
                            total: 50_000,
                        },
                        checkpoint_at: 100_000,
                    },
                },
                createMessage(AgentMessageType.IDLE, 'Waiting for your command...'),
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            hideMessageInput: false,
            interactive: true,
            allowWorkflowControl: true,
        });

        const selector = await screen.findByRole('button', { name: 'Agent approval mode' });
        expect((selector as HTMLButtonElement).disabled).toBe(false);

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            contextWindowUsage?: {
                usedTokens: number;
                checkpointTokens: number;
                usedPercent: number;
                remainingPercent: number;
            };
            onCompactContext?: () => void | Promise<void>;
        };

        expect(latestMessageInputProps.contextWindowUsage).toEqual({
            usedTokens: 50_000,
            checkpointTokens: 100_000,
            usedPercent: 50,
            remainingPercent: 50,
        });
        expect(latestMessageInputProps.onCompactContext).toBeTypeOf('function');
    });

    it('derives context usage from persisted messages and sends manual compact signal', async () => {
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'Planning the next tool call'),
                    details: {
                        token_usage: {
                            prompt: 40_000,
                            result: 10_000,
                            total: 50_000,
                        },
                        checkpoint_at: 100_000,
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false });

        expect(mocks.messageInputProps).toHaveBeenCalled();

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            contextWindowUsage?: {
                usedTokens: number;
                checkpointTokens: number;
                usedPercent: number;
                remainingPercent: number;
            };
            onCompactContext?: () => void | Promise<void>;
        };

        expect(latestMessageInputProps.contextWindowUsage).toEqual({
            usedTokens: 50_000,
            checkpointTokens: 100_000,
            usedPercent: 50,
            remainingPercent: 50,
        });

        act(() => {
            void latestMessageInputProps.onCompactContext?.();
        });

        expect(mocks.sendSignal).toHaveBeenCalledWith('agent-run-1', 'TriggerCheckpoint', {
            reason: 'manual user request',
        });
    });

    it('derives context usage from approval request messages when no preamble was posted', () => {
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.REQUEST_INPUT, 'Approve Create Document?'),
                    details: {
                        tool_approval: {
                            tool_name: 'create_document',
                            tool_title: 'Create Document',
                            target: 'name:Budget plan',
                        },
                        token_usage: {
                            total: 82_000,
                        },
                        checkpoint_threshold: 100_000,
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false, interactive: true, allowWorkflowControl: true });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            contextWindowUsage?: {
                usedTokens: number;
                checkpointTokens: number;
                usedPercent: number;
                remainingPercent: number;
            };
            onCompactContext?: () => void | Promise<void>;
        };

        expect(latestMessageInputProps.contextWindowUsage).toEqual({
            usedTokens: 82_000,
            checkpointTokens: 100_000,
            usedPercent: 82,
            remainingPercent: 18,
        });
        expect(latestMessageInputProps.onCompactContext).toBeTypeOf('function');
    });

    it('makes it explicit that the composer still messages the main agent while viewing a workstream', async () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'France workstream launched'),
                    timestamp: 2_000,
                    workstream_id: 'france_news_agent',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        workstream_id: 'france_news_agent',
                        interaction: 'sys:AdhocTaskAgent',
                    },
                },
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'France internal search'),
                    timestamp: 3_000,
                    workstream_id: 'france_news_agent',
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ hideMessageInput: false });

        act(() => {
            latestAllMessagesMixedProps()?.onActiveWorkstreamChange?.('france_news_agent');
        });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            placeholder?: string;
        };

        expect(latestMessageInputProps.placeholder).toBe('Message @Main Agent (viewing France News Agent)...');

        fireEvent.click(screen.getByRole('button', { name: 'composer send' }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith(
                'agent-run-1',
                'UserInput',
                expect.objectContaining({ message: 'follow up' }),
            );
        });
        expect(mocks.addOptimisticMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'follow up',
                workstream_id: 'main',
            }),
        );
    });

    it('uses message-derived workstreams for panel history while the composer only counts active workstreams', async () => {
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
            onRestart: vi.fn(),
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
            expect.objectContaining({ workstream_id: 'gamma', status: 'completed' }),
        ]);
        expect(latestRightPanelProps.activeTab).toBe('plan');
        expect(latestMessageInputProps.activeTaskCount).toBe(2);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'alpha', status: 'running' }),
            expect.objectContaining({ workstream_id: 'beta', status: 'running' }),
        ]);
    });

    it('shows completed workstream lifecycle messages in the panel without counting them as active', async () => {
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
            expect.objectContaining({ workstream_id: 'qa_tasks', status: 'completed' }),
        ]);
        expect(latestMessageInputProps.activeTaskCount).toBe(1);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([
            expect.objectContaining({ workstream_id: 'qa_assignee', status: 'running' }),
        ]);
    });

    it('keeps message-derived workstream history when the live workstream query fails', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.getActiveWorkstreams.mockRejectedValueOnce(new Error('workflow no longer queryable'));
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
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        try {
            renderConversation({
                hideMessageInput: false,
                hideWorkstreamTabs: false,
                showRightPanel: true,
            });

            await waitFor(() => {
                expect(mocks.getActiveWorkstreams).toHaveBeenCalled();
                const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
                    activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
                };
                expect(latestRightPanelProps.activeWorkstreams).toEqual([
                    expect.objectContaining({ workstream_id: 'qa_tasks', status: 'completed' }),
                ]);
            });

            const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
                activeTaskCount?: number;
                activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
            };
            expect(latestMessageInputProps.activeTaskCount).toBe(0);
            expect(latestMessageInputProps.activeWorkstreams).toEqual([]);
        } finally {
            warn.mockRestore();
        }
    });

    it('marks failed pre-launch workstream activities as failed instead of active', async () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Provisioning browser sandbox for "Create Bookmark"...'),
                    workstream_id: 'create_bookmark',
                    details: {
                        event_class: 'activity',
                        workstream_id: 'create_bookmark',
                    },
                },
                {
                    ...createMessage(
                        AgentMessageType.ERROR,
                        'Failed to provision browser sandbox: Request failed with status code 502',
                    ),
                    workstream_id: 'create_bookmark',
                    details: {
                        event_class: 'activity',
                        workstream_id: 'create_bookmark',
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
            const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
                activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
            };
            expect(latestRightPanelProps.activeWorkstreams).toEqual([
                expect.objectContaining({ workstream_id: 'create_bookmark', status: 'failed' }),
            ]);
        });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            activeTaskCount?: number;
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        };
        expect(latestMessageInputProps.activeTaskCount).toBe(0);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([]);
    });

    it('does not let stale active workstream queries override terminal message-derived state', async () => {
        mocks.getActiveWorkstreams.mockResolvedValue({
            running: [
                {
                    launch_id: 'launch-create-bookmark',
                    workstream_id: 'create_bookmark',
                    interaction: 'sys:BrowserAgent',
                    started_at: Date.now() - 5000,
                    elapsed_ms: 5000,
                    deadline_ms: 30000,
                    status: 'running',
                },
            ],
        });
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Provisioning browser sandbox for "Create Bookmark"...'),
                    workstream_id: 'create_bookmark',
                    details: {
                        event_class: 'activity',
                        workstream_id: 'create_bookmark',
                    },
                },
                {
                    ...createMessage(
                        AgentMessageType.ERROR,
                        'Failed to provision browser sandbox: Request failed with status code 502',
                    ),
                    workstream_id: 'create_bookmark',
                    details: {
                        event_class: 'activity',
                        workstream_id: 'create_bookmark',
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
            const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
                activeWorkstreams?: Array<{ workstream_id: string; status: string; interaction?: string }>;
            };
            expect(latestRightPanelProps.activeWorkstreams).toEqual([
                expect.objectContaining({
                    workstream_id: 'create_bookmark',
                    status: 'failed',
                    interaction: 'sys:BrowserAgent',
                }),
            ]);
        });

        const latestMessageInputProps = mocks.messageInputProps.mock.lastCall?.[0] as {
            activeTaskCount?: number;
            activeWorkstreams?: Array<{ workstream_id: string; status: string }>;
        };
        expect(latestMessageInputProps.activeTaskCount).toBe(0);
        expect(latestMessageInputProps.activeWorkstreams).toEqual([]);
    });

    it('uses the live workstream query to enrich message-derived running workstreams', async () => {
        mocks.getActiveWorkstreams.mockResolvedValue({
            running: [
                {
                    launch_id: 'launch-alpha',
                    workstream_id: 'alpha',
                    interaction: 'sys:AlphaAgent',
                    started_at: Date.now() - 5000,
                    elapsed_ms: 5000,
                    deadline_ms: 30000,
                    status: 'running',
                    latest_progress: {
                        launch_id: 'launch-alpha',
                        workstream_id: 'alpha',
                        phase: 'executing_tool',
                        updated_at: Date.now(),
                    },
                    child_workflow_id: 'child-alpha',
                    child_workflow_run_id: 'child-run-alpha',
                },
            ],
        });
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'main request'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Workstream "alpha" launched'),
                    workstream_id: 'alpha',
                    details: {
                        workstream_event: 'launched',
                        workstream_id: 'alpha',
                        launch_id: 'launch-alpha',
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
            const latestRightPanelProps = mocks.rightPanelProps.mock.lastCall?.[0] as {
                activeWorkstreams?: Array<{
                    workstream_id: string;
                    status: string;
                    elapsed_ms?: number;
                    phase?: string;
                    child_workflow_run_id?: string;
                }>;
            };
            expect(latestRightPanelProps.activeWorkstreams).toEqual([
                expect.objectContaining({
                    workstream_id: 'alpha',
                    status: 'running',
                    elapsed_ms: 5000,
                    phase: 'executing_tool',
                    child_workflow_run_id: 'child-run-alpha',
                }),
            ]);
        });
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

    it('passes commented approval denial metadata through the request overlay signal', async () => {
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.REQUEST_INPUT, 'Approve Write Artifact: quotes.md?'),
                    details: {
                        tool_approval: {
                            tool_name: 'write_artifact',
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
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation();

        fireEvent.change(screen.getByPlaceholderText('No, and tell the agent what to do differently'), {
            target: { value: 'Do not write a file. Put the summary in chat.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledTimes(1);
        });
        expect(mocks.sendSignal).toHaveBeenCalledWith(
            'agent-run-1',
            'UserInput',
            expect.objectContaining({
                message: 'Do not write a file. Put the summary in chat.',
                metadata: expect.objectContaining({
                    tool_approval_response: {
                        decision: 'deny_with_feedback',
                        approval_key: 'write_artifact:name:quotes.md',
                    },
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

    it('adds an optimistic stop marker and marks it received when Stop is signaled', async () => {
        const stopRef = { current: null } as React.MutableRefObject<(() => void) | null>;
        mockStreamState({
            messages: [createMessage(AgentMessageType.THOUGHT, 'working')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ stopRef });

        await waitFor(() => {
            expect(stopRef.current).toBeTypeOf('function');
        });

        act(() => {
            stopRef.current?.();
        });

        const optimisticMessage = mocks.addOptimisticMessage.mock.calls[0]?.[0] as AgentMessage | undefined;
        expect(optimisticMessage).toEqual(
            expect.objectContaining({
                type: AgentMessageType.IDLE,
                message: 'Stopped. Waiting for your command...',
                details: expect.objectContaining({
                    _optimistic: true,
                    _messageId: expect.any(String),
                    _deliveryStatus: 'sending',
                    status_reason: 'user_stopped',
                }),
            }),
        );
        await waitFor(() => {
            expect(mocks.sendSignal).toHaveBeenCalledWith(
                'agent-run-1',
                'Stop',
                expect.objectContaining({
                    client_message_id: optimisticMessage?.details?._messageId,
                    metadata: expect.objectContaining({
                        id: optimisticMessage?.details?._messageId,
                        _messageId: optimisticMessage?.details?._messageId,
                    }),
                }),
            );
        });
        expect(mocks.updateOptimisticMessageStatus).toHaveBeenCalledWith(
            optimisticMessage?.details?._messageId,
            'received',
        );
    });

    it('marks an optimistic stop marker failed when Stop signaling fails', async () => {
        const stopRef = { current: null } as React.MutableRefObject<(() => void) | null>;
        mocks.sendSignal.mockRejectedValueOnce(new Error('stop failed'));
        mockStreamState({
            messages: [createMessage(AgentMessageType.THOUGHT, 'working')],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ stopRef });

        await waitFor(() => {
            expect(stopRef.current).toBeTypeOf('function');
        });

        act(() => {
            stopRef.current?.();
        });

        const optimisticMessage = mocks.addOptimisticMessage.mock.calls[0]?.[0] as AgentMessage | undefined;
        await waitFor(() => {
            expect(mocks.updateOptimisticMessageStatus).toHaveBeenCalledWith(
                optimisticMessage?.details?._messageId,
                'failed',
            );
        });
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
            expect(latestAllMessagesMixedProps()?.isCompleted).toBe(false);
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
            expect(latestAllMessagesMixedProps()?.isCompleted).toBe(true);
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

    it('scopes playback controls to the active workstream', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'Compare France and Japan news.'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Japan workstream launched.'),
                    timestamp: 2_000,
                    workstream_id: 'japan_news',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        workstream_id: 'japan_news',
                        interaction: 'sys:AdhocTaskAgent',
                    },
                },
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'Japan internal search.'),
                    timestamp: 3_000,
                    workstream_id: 'japan_news',
                },
                {
                    ...createMessage(AgentMessageType.ANSWER, 'Japan internal answer.'),
                    timestamp: 4_000,
                    workstream_id: 'japan_news',
                },
                {
                    ...createMessage(AgentMessageType.UPDATE, 'France workstream launched.'),
                    timestamp: 5_000,
                    workstream_id: 'france_news',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        workstream_id: 'france_news',
                        interaction: 'sys:AdhocTaskAgent',
                    },
                },
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'France internal search.'),
                    timestamp: 6_000,
                    workstream_id: 'france_news',
                },
                createMessage(AgentMessageType.ANSWER, 'Main monitoring update.'),
            ],
        });

        renderConversation({ enablePlayback: true });

        const controls = screen.getByTestId('agent-test-playback-controls');
        expect(controls.getAttribute('data-live-message-count')).toBe('4');
        expect(screen.getByTestId('rendered-message-count').textContent).toBe('4');

        act(() => {
            latestAllMessagesMixedProps()?.onActiveWorkstreamChange?.('japan_news');
        });

        expect(screen.getByTestId('agent-test-playback-controls').getAttribute('data-live-message-count')).toBe('2');
        expect(screen.getByTestId('rendered-message-count').textContent).toBe('2');
        expect(latestAllMessagesMixedProps()?.activeWorkstream).toBe('japan_news');

        fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

        expect(screen.getByTestId('rendered-message-count').textContent).toBe('1');
    });

    it('only enables the synthetic initial request after empty history while no real messages exist', () => {
        mockStreamState({
            messages: [],
            isCompleted: false,
            initialHistoryStatus: 'empty',
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            initialRequestData: { task: 'What are the news headlines in France today?' },
        });

        expect(latestAllMessagesMixedProps()?.showInitialRequest).toBe(true);
    });

    it('disables the synthetic initial request when real messages arrive after an empty history race', () => {
        mockStreamState({
            messages: [createMessage(AgentMessageType.ANSWER, 'Current French headlines...')],
            isCompleted: true,
            initialHistoryStatus: 'empty',
            agentRunStatus: 'COMPLETED',
        });

        renderConversation({
            initialRequestData: { task: 'What are the news headlines in France today?' },
        });

        expect(latestAllMessagesMixedProps()?.showInitialRequest).toBe(false);
    });

    it('does not enable the synthetic initial request while history is still loading', () => {
        mockStreamState({
            messages: [],
            isCompleted: false,
            initialHistoryStatus: 'loading',
            agentRunStatus: 'RUNNING',
        });

        renderConversation({
            initialRequestData: { task: 'What are the news headlines in France today?' },
        });

        expect(latestAllMessagesMixedProps()?.showInitialRequest).toBe(false);
    });

    it('does not poll live workstreams while initial history is loading', () => {
        mockStreamState({
            messages: [],
            isCompleted: false,
            initialHistoryStatus: 'loading',
            agentRunStatus: 'RUNNING',
        });

        renderConversation();

        expect(mocks.getActiveWorkstreams).not.toHaveBeenCalled();
    });

    it('stops polling live workstreams when the server marks the query unavailable', async () => {
        vi.useFakeTimers();
        mocks.getActiveWorkstreams.mockResolvedValue({ running: [], completed: [], unavailable: true });
        mockStreamState({
            messages: [createMessage(AgentMessageType.QUESTION, 'main request')],
            isCompleted: false,
            initialHistoryStatus: 'has_messages',
            agentRunStatus: 'RUNNING',
        });

        try {
            renderConversation();

            await act(async () => {
                await Promise.resolve();
            });
            const callCountAfterUnavailable = mocks.getActiveWorkstreams.mock.calls.length;
            expect(callCountAfterUnavailable).toBeGreaterThan(0);

            await act(async () => {
                vi.advanceTimersByTime(10_000);
            });
            expect(mocks.getActiveWorkstreams).toHaveBeenCalledTimes(callCountAfterUnavailable);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not overlap live workstream polls while a previous request is pending', async () => {
        vi.useFakeTimers();
        const resolveQueries: Array<(value: { running: [] }) => void> = [];
        mocks.getActiveWorkstreams.mockImplementation(
            () =>
                new Promise<{ running: [] }>((resolve) => {
                    resolveQueries.push(resolve);
                }),
        );
        mockStreamState({
            messages: [createMessage(AgentMessageType.QUESTION, 'main request')],
            isCompleted: false,
            initialHistoryStatus: 'has_messages',
            agentRunStatus: 'RUNNING',
        });

        try {
            renderConversation();

            const initialCallCount = mocks.getActiveWorkstreams.mock.calls.length;
            expect(initialCallCount).toBeGreaterThan(0);

            await act(async () => {
                vi.advanceTimersByTime(10_000);
            });
            expect(mocks.getActiveWorkstreams).toHaveBeenCalledTimes(initialCallCount);

            await act(async () => {
                for (const resolveQuery of resolveQueries) {
                    resolveQuery({ running: [] });
                }
            });
            await act(async () => {
                vi.advanceTimersByTime(10_000);
            });
            expect(mocks.getActiveWorkstreams.mock.calls.length).toBeGreaterThan(initialCallCount);
        } finally {
            vi.useRealTimers();
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

    it('shows a disabled MCP request overlay while viewing rewound playback history', async () => {
        mockStreamState({
            messages: [
                {
                    ...createMessage(AgentMessageType.REQUEST_INPUT, 'Connect to Jira to continue.'),
                    timestamp: 1_000,
                    details: {
                        ux: {
                            mcp_connect: {
                                app_install_id: 'app1',
                                collection_id: 'jira',
                                name: 'Jira',
                            },
                        },
                    },
                },
                {
                    ...createMessage(AgentMessageType.QUESTION, "I've connected to Jira."),
                    timestamp: 2_000,
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ enablePlayback: true, hideMessageInput: false });

        expect(screen.getByRole('button', { name: 'composer send' })).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

        await waitFor(() => {
            expect(screen.getByText('Connect to Jira to continue.')).not.toBeNull();
        });
        expect(screen.queryByRole('button', { name: 'composer send' })).toBeNull();
        expect((screen.getByRole('button', { name: /connect/i }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: /decline/i }) as HTMLButtonElement).disabled).toBe(true);
        expect(mocks.allMessagesMixedProps.mock.lastCall?.[0]).toEqual(
            expect.objectContaining({ renderRequestInputControls: false }),
        );
    });

    it('shows active workstreams for the rewound playback cursor', () => {
        mockStreamState({
            messages: [
                createMessage(AgentMessageType.QUESTION, 'Compare France and Japan news.'),
                {
                    ...createMessage(AgentMessageType.UPDATE, 'Japan workstream launched.'),
                    timestamp: 2_000,
                    workstream_id: 'japan_news',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        workstream_id: 'japan_news',
                        interaction: 'sys:AdhocTaskAgent',
                    },
                },
                {
                    ...createMessage(AgentMessageType.THOUGHT, 'Japan internal search.'),
                    timestamp: 3_000,
                    workstream_id: 'japan_news',
                },
                {
                    ...createMessage(AgentMessageType.UPDATE, 'France workstream launched.'),
                    timestamp: 4_000,
                    workstream_id: 'france_news',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        workstream_id: 'france_news',
                        interaction: 'sys:AdhocTaskAgent',
                    },
                },
            ],
            isCompleted: false,
            agentRunStatus: 'RUNNING',
        });

        renderConversation({ enablePlayback: true, hideMessageInput: false });

        expect(document.querySelector('[data-agent-active-workstreams]')).toBeNull();

        const playbackPositionInput = screen.getByRole('textbox', { name: 'Playback position' });
        fireEvent.change(playbackPositionInput, {
            target: { value: '2' },
        });
        fireEvent.blur(playbackPositionInput, {
            target: { value: '2' },
        });

        expect(document.querySelector('[data-agent-active-workstreams]')).not.toBeNull();
        expect(screen.getByText('Japan News')).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'composer send' })).toBeNull();
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
