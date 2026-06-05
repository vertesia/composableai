import { fireEvent, render, screen } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { UserSession, UserSessionContext } from '../../../../session/index.js';
import AllMessagesMixed from './AllMessagesMixed';
import type { StreamingData } from './utils';

function makeMessage(overrides: Partial<AgentMessage>): AgentMessage {
    return {
        timestamp: 0,
        workflow_run_id: 'run-1',
        type: AgentMessageType.THOUGHT,
        message: '',
        workstream_id: 'main',
        ...overrides,
    };
}

function renderSummary(
    messages: AgentMessage[],
    isCompleted = false,
    streamingMessages = new Map<string, StreamingData>(),
) {
    const bottomRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;

    return render(
        <I18nProvider lng="en">
            <AllMessagesMixed
                messages={messages}
                bottomRef={bottomRef}
                viewMode="sliding"
                isCompleted={isCompleted}
                artifactRunId="run-1"
                streamingMessages={streamingMessages}
            />
        </I18nProvider>,
    );
}

function renderStacked(messages: AgentMessage[], isCompleted = true) {
    const bottomRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
    const session = new UserSession({
        files: {
            getArtifactDownloadUrl: vi.fn(),
        },
    } as unknown as VertesiaClient);

    return render(
        <I18nProvider lng="en">
            <UserSessionContext.Provider value={session}>
                <AllMessagesMixed
                    messages={messages}
                    bottomRef={bottomRef}
                    viewMode="stacked"
                    isCompleted={isCompleted}
                    artifactRunId="run-1"
                />
            </UserSessionContext.Provider>
        </I18nProvider>,
    );
}

describe('AllMessagesMixed summary view', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-31T00:00:00.000Z'));
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders completed tool activity as a collapsed Worked row that expands to tool details', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Find Japan news.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Searching for Japan news',
                    details: {
                        tool: 'web_search_serper',
                        tool_status: 'completed',
                        tool_run_id: 'tool-1',
                        query: 'Japan news',
                        output: 'Found 5 results',
                    },
                }),
                makeMessage({
                    timestamp: 5_000,
                    type: AgentMessageType.ANSWER,
                    message: 'Here are the headlines.',
                }),
            ],
            true,
        );

        expect(screen.getByText('Find Japan news.')).not.toBeNull();
        expect(screen.getByText('Here are the headlines.')).not.toBeNull();

        const workedRow = screen.getByRole('button', { name: /Worked\s*for\s*3s/ });
        expect(workedRow.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('Found 5 results')).toBeNull();

        fireEvent.click(workedRow);

        expect(workedRow.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Search')).not.toBeNull();
        expect(screen.getByText('Japan news')).not.toBeNull();

        const toolRow = screen.getByRole('button', { name: /Search\s*Japan news/ });
        expect(toolRow.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toolRow);

        expect(screen.getByText('Found 5 results')).not.toBeNull();
    });

    it('renders active tool activity as an expanded Working row', () => {
        renderSummary([
            makeMessage({
                timestamp: Date.now() - 2_000,
                type: AgentMessageType.QUESTION,
                message: 'Check the latest build status.',
            }),
            makeMessage({
                timestamp: Date.now() - 1_000,
                message: 'Running build',
                details: {
                    tool: 'bash',
                    tool_status: 'running',
                    tool_run_id: 'tool-1',
                    command: 'pnpm run build',
                },
            }),
        ]);

        const workingRow = screen.getByRole('button', { name: /Working\s*for\s*1s/ });
        expect(workingRow.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Bash')).not.toBeNull();
        expect(screen.getByText('pnpm run build')).not.toBeNull();

        const toolRow = screen.getByRole('button', { name: /Bash\s*pnpm run build/ });
        fireEvent.click(toolRow);

        expect(screen.getByText('Shell')).not.toBeNull();
        expect(screen.getByText('$ pnpm run build')).not.toBeNull();
        expect(screen.getByText('Running')).not.toBeNull();
    });

    it('renders thought prose between tool rows inside expanded work details', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Fix the auth bug.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Reading OAuth form',
                    details: {
                        tool: 'read_file',
                        tool_status: 'completed',
                        tool_run_id: 'tool-1',
                        path: 'OAuthClientForm.tsx',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    type: AgentMessageType.THOUGHT,
                    message: 'The form source is better than the UI, so I will inspect the serialization path.',
                }),
                makeMessage({
                    timestamp: 4_000,
                    message: 'Searching API serialization',
                    details: {
                        tool: 'rg',
                        tool_status: 'completed',
                        tool_run_id: 'tool-2',
                        query: 'allowed_scopes',
                    },
                }),
                makeMessage({
                    timestamp: 5_000,
                    type: AgentMessageType.ANSWER,
                    message: 'Found the issue.',
                }),
            ],
            true,
        );

        const workedRow = screen.getByRole('button', { name: /Worked\s*for\s*3s/ });
        fireEvent.click(workedRow);

        expect(screen.queryByText('Thought')).toBeNull();
        expect(
            screen.getByText('The form source is better than the UI, so I will inspect the serialization path.'),
        ).not.toBeNull();
        expect(screen.getByText('OAuthClientForm.tsx')).not.toBeNull();
        expect(screen.getByText('allowed_scopes')).not.toBeNull();
    });

    it('renders legacy think tool rows as thought prose in expanded summary work details', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in Tokyo today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Thinking about how to get the news headlines for Tokyo.',
                    details: {
                        event_class: 'activity',
                        tool: 'think',
                        tool_run_id: 'tool-1',
                        tool_iteration: 1,
                        tool_status: 'running',
                        activity_group_id: 'activity-1',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    message: 'Updating 1 tasks of our plan.',
                    details: {
                        event_class: 'activity',
                        tool: 'update_plan',
                        tool_run_id: 'tool-2',
                        tool_status: 'completed',
                        activity_group_id: 'activity-2',
                    },
                }),
            ],
            true,
        );

        const workedRow = screen.getByRole('button', { name: /Worked\s*for/ });
        fireEvent.click(workedRow);

        expect(screen.getByText('Thinking about how to get the news headlines for Tokyo.')).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Tool\s+Thinking about how/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Tool\s*Updating 1 tasks of our plan/ })).not.toBeNull();
    });

    it('renders completed streaming answers as visible summary prose before later tool activity', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in Tokyo today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.THOUGHT,
                    message: 'Thinking...',
                    details: {
                        display_role: 'thinking',
                        activity_id: 'reply-1',
                    },
                }),
                makeMessage({
                    timestamp: 4_000,
                    type: AgentMessageType.THOUGHT,
                    message: 'I have extracted the relevant news headlines and presented them.',
                    details: {
                        tool: 'update_plan',
                        tool_status: 'running',
                        tool_run_id: 'tool-1',
                    },
                }),
                makeMessage({
                    timestamp: 5_000,
                    type: AgentMessageType.IDLE,
                    message: 'Waiting for your command...',
                }),
            ],
            true,
            new Map([
                [
                    'reply-1',
                    {
                        text: 'Here are some of the top news headlines related to Tokyo today.',
                        startTimestamp: 3_000,
                        activityId: 'reply-1',
                        isComplete: true,
                    },
                ],
            ]),
        );

        expect(screen.getByText('What are the news headlines in Tokyo today?')).not.toBeNull();
        expect(screen.getByText('Here are some of the top news headlines related to Tokyo today.')).not.toBeNull();
        expect(screen.getByRole('button', { name: /Worked\s*for/ })).not.toBeNull();
    });

    it('keeps a stacked thought as its own message instead of consuming it as a tool preamble', () => {
        renderStacked([
            makeMessage({
                timestamp: 1_000,
                message: 'Reading OAuth form',
                details: {
                    tool: 'read_file',
                    tool_status: 'completed',
                    tool_run_id: 'tool-1',
                },
            }),
            makeMessage({
                timestamp: 2_000,
                type: AgentMessageType.THOUGHT,
                message: 'I need to inspect the API serialization path next.',
            }),
            makeMessage({
                timestamp: 3_000,
                message: 'Searching API serialization',
                details: {
                    tool: 'rg',
                    tool_status: 'completed',
                    tool_run_id: 'tool-2',
                },
            }),
        ]);

        const thought = screen.getByText('I need to inspect the API serialization path next.');
        expect(thought.closest('[data-workstream-id="main"]')).not.toBeNull();
    });

    it('renders an explicit tool preamble as standalone stacked prose', () => {
        renderStacked([
            makeMessage({
                timestamp: 1_000,
                type: AgentMessageType.THOUGHT,
                message: 'I will inspect the available documents before editing.',
                details: {
                    display_role: 'tool_preamble',
                    tools: ['search_documents'],
                    activity_group_id: 'activity-1',
                },
            }),
            makeMessage({
                timestamp: 2_000,
                message: 'Searching documents',
                details: {
                    tool: 'search_documents',
                    tool_status: 'completed',
                    tool_run_id: 'tool-1',
                    activity_group_id: 'activity-1',
                },
            }),
        ]);

        const preamble = screen.getByText('I will inspect the available documents before editing.');
        expect(preamble.closest('[data-workstream-id="main"]')).not.toBeNull();
        expect(screen.getByText('Searching documents')).not.toBeNull();
    });

    it('merges tool lifecycle and progress messages into one visual tool item', () => {
        renderStacked([
            makeMessage({
                timestamp: 1_000,
                message: 'Find source documents',
                details: {
                    tool: 'search_documents',
                    tool_run_id: 'tool-1',
                    tool_use_id: 'toolu-1',
                    tool_status: 'running',
                    tool_event: 'started',
                    activity_group_id: 'activity-1',
                    message_to_human: 'Find source documents',
                },
            }),
            makeMessage({
                timestamp: 2_000,
                message: 'Searching vector index',
                details: {
                    tool: 'search_documents',
                    tool_run_id: 'tool-1',
                    tool_use_id: 'toolu-1',
                    tool_status: 'running',
                    tool_event: 'progress',
                    activity_group_id: 'activity-1',
                },
            }),
            makeMessage({
                timestamp: 3_000,
                message: '3 docs matched',
                details: {
                    tool: 'search_documents',
                    tool_run_id: 'tool-1',
                    tool_use_id: 'toolu-1',
                    tool_status: 'completed',
                    tool_event: 'progress',
                    activity_group_id: 'activity-1',
                },
            }),
            makeMessage({
                timestamp: 4_000,
                message: '',
                details: {
                    tool: 'search_documents',
                    tool_run_id: 'tool-1',
                    tool_use_id: 'toolu-1',
                    tool_status: 'completed',
                    tool_event: 'completed',
                    activity_group_id: 'activity-1',
                    observation: 'Found 3 relevant docs.',
                },
            }),
        ]);

        expect(screen.getByText('Find source documents')).not.toBeNull();
        expect(screen.queryByText('Searching vector index')).toBeNull();

        const toolRow = screen.getByRole('button', { name: /Find source documents/ });
        fireEvent.click(toolRow);

        expect(screen.getByText('Progress')).not.toBeNull();
        expect(screen.getByText('Searching vector index')).not.toBeNull();
        expect(screen.getByText('3 docs matched')).not.toBeNull();
        expect(screen.getByText('Found 3 relevant docs.')).not.toBeNull();
        expect(screen.getByText('completed')).not.toBeNull();
    });
});
