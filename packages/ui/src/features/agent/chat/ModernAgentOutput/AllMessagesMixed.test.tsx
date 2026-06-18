import { fireEvent, render, screen } from '@testing-library/react';
import type { VertesiaClient } from '@vertesia/client';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { ReactRouterContext, type RouterContext } from '../../../../router/index.js';
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
    props: Partial<React.ComponentProps<typeof AllMessagesMixed>> = {},
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
                {...props}
            />
        </I18nProvider>,
    );
}

function renderStacked(
    messages: AgentMessage[],
    isCompleted = true,
    props: Partial<React.ComponentProps<typeof AllMessagesMixed>> = {},
) {
    const bottomRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
    const session = new UserSession({
        files: {
            getArtifactDownloadUrl: vi.fn(),
        },
    } as unknown as VertesiaClient);
    const routerContext = {
        location: window.location,
        route: { path: '/', Component: () => null },
        params: {},
        state: null,
        matchedRoutePath: '/',
        navigate: vi.fn(),
        router: {
            navigate: vi.fn(),
            getTopRouter: () => ({
                navigator: {
                    addStickyParams: (href: string) => href,
                },
            }),
        },
    } as unknown as RouterContext;

    return render(
        <I18nProvider lng="en">
            <ReactRouterContext.Provider value={routerContext}>
                <UserSessionContext.Provider value={session}>
                    <AllMessagesMixed
                        messages={messages}
                        bottomRef={bottomRef}
                        viewMode="stacked"
                        isCompleted={isCompleted}
                        artifactRunId="run-1"
                        {...props}
                    />
                </UserSessionContext.Provider>
            </ReactRouterContext.Provider>
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

    it('renders delivery status on user bubbles in summary view', () => {
        renderSummary([
            makeMessage({
                timestamp: 1_000,
                type: AgentMessageType.QUESTION,
                message: 'Find Japan news.',
                details: {
                    _deliveryStatus: 'consumed',
                    ack: 'message-1',
                },
            }),
        ]);

        expect(screen.getByLabelText('Message consumed')).not.toBeNull();
    });

    it('renders delivery status on user messages in stacked view', () => {
        renderStacked([
            makeMessage({
                timestamp: 1_000,
                type: AgentMessageType.QUESTION,
                message: 'Find Japan news.',
                details: {
                    _deliveryStatus: 'sending',
                    _messageId: 'message-1',
                },
            }),
        ]);

        expect(screen.getByLabelText('Sending message')).not.toBeNull();
    });

    it('renders an acked stop marker as a right-aligned consumed status row', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.THOUGHT,
                    message: 'Searching',
                    details: {
                        tool: 'web_search',
                        tool_status: 'running',
                        tool_run_id: 'tool-1',
                    },
                }),
                makeMessage({
                    timestamp: 77_000,
                    type: AgentMessageType.IDLE,
                    message: 'Stopped. Waiting for your command...',
                    details: {
                        ack: 'stop-1',
                        status_reason: 'user_stopped',
                    },
                }),
            ],
            true,
        );

        expect(screen.getByTestId('summary-stopped-message')).not.toBeNull();
        expect(screen.getByText('You stopped after 1m 15s')).not.toBeNull();
        expect(screen.getByLabelText('Message consumed')).not.toBeNull();
        expect(screen.queryByText('Stopped. Waiting for your command...')).toBeNull();
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
        expect(screen.queryByText('Search')).toBeNull();
        expect(screen.getByText('Japan news')).not.toBeNull();

        const toolRow = screen.getByRole('button', { name: /Japan news/ });
        expect(toolRow.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toolRow);

        expect(screen.getByText('Tool')).not.toBeNull();
        expect(screen.getByText('web_search_serper')).not.toBeNull();
        expect(screen.getByText('Time')).not.toBeNull();
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
        expect(screen.queryByText('Bash')).toBeNull();
        expect(screen.getByText('Running build')).not.toBeNull();
        expect(screen.queryByText('$ pnpm run build')).toBeNull();

        const toolRow = screen.getByRole('button', { name: /Running build/ });
        fireEvent.click(toolRow);

        expect(screen.queryByText('Shell')).toBeNull();
        expect(screen.getByText('$ pnpm run build')).not.toBeNull();
        expect(screen.queryByText('Running')).toBeNull();
    });

    it('expands tool rows that only have metadata', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Warm the cache.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Loading cache',
                    details: {
                        tool: 'cache_loader',
                        tool_status: 'completed',
                        tool_run_id: 'tool-cache',
                    },
                }),
            ],
            true,
        );

        fireEvent.click(screen.getByRole('button', { name: /Worked\s*for/ }));

        const toolRow = screen.getByRole('button', { name: /Loading cache/ });
        expect(toolRow.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('cache_loader')).toBeNull();

        fireEvent.click(toolRow);

        expect(toolRow.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText('Tool')).not.toBeNull();
        expect(screen.getByText('cache_loader')).not.toBeNull();
        expect(screen.getByText('Time')).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'Copy tool details' })).toBeNull();
    });

    it('renders workstream launch events as inline workstream rows', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Check the app.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.UPDATE,
                    message: 'Workstream "qa_tasks" launched',
                    workstream_id: 'qa_tasks',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        launch_id: 'launch-1',
                        workstream_id: 'qa_tasks',
                        kind: 'agent',
                        interaction: 'sys:BrowserAgent',
                        child_workflow_id: 'workstream:qa_tasks',
                        child_workflow_run_id: 'run-qa-tasks',
                    },
                }),
            ],
            true,
        );

        expect(screen.getByText('Workstreams')).not.toBeNull();
        expect(screen.getByText('QA Tasks')).not.toBeNull();
        expect(screen.getByText('Browser Agent')).not.toBeNull();
    });

    it('suppresses JSON-only child workstream results in summary view', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Generate a picture.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.THOUGHT,
                    message: 'I am generating the image with a specialist agent.',
                    details: {
                        streamed: true,
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    type: AgentMessageType.UPDATE,
                    message: 'Workstream "ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6" launched',
                    workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                    details: {
                        event_class: 'activity',
                        workstream_event: 'launched',
                        launch_id: 'launch-1',
                        workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                        kind: 'agent',
                        interaction: 'ImageGeneratorAgent',
                    },
                }),
                makeMessage({
                    timestamp: 4_000,
                    type: AgentMessageType.ANSWER,
                    message: '{"generated_images":["store:object-1"]}',
                    workstream_id: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                    details: {
                        event_class: 'user_content',
                        streamed: true,
                    },
                }),
                makeMessage({
                    timestamp: 5_000,
                    type: AgentMessageType.ANSWER,
                    message: 'I saved the generated image as a content object.',
                    workstream_id: 'main',
                }),
            ],
            true,
            new Map([
                [
                    'stream-json',
                    {
                        text: '{"generated_images":["store:object-2"]}',
                        workstreamId: 'ImageGeneratorAgent-16b7f73a-8e8e-40b7-b891-cb47a78c38c6',
                        isComplete: true,
                        startTimestamp: 4_500,
                    },
                ],
            ]),
        );

        expect(screen.getByText('Generate a picture.')).not.toBeNull();
        expect(screen.getByText('Image Generator Agent')).not.toBeNull();
        expect(screen.getByText('I saved the generated image as a content object.')).not.toBeNull();
        expect(screen.queryByText(/generated_images/)).toBeNull();
        expect(screen.queryByText(/store:object/)).toBeNull();
    });

    it('renders question attachment markdown as a store object link in summary view', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: [
                        'what is in this image?',
                        '',
                        'Attachments:',
                        '[tokyo-tower_1 (1).jpg](/store/objects/6a17fc9544c9629943624589)',
                    ].join('\n'),
                }),
            ],
            true,
            new Map(),
            {
                StoreLinkComponent: ({ href, documentId, children }) => (
                    <a href={href} data-document-id={documentId}>
                        {children}
                    </a>
                ),
            },
        );

        const link = screen.getByRole('link', { name: 'tokyo-tower_1 (1).jpg' });

        expect(screen.getByText('what is in this image?')).not.toBeNull();
        expect(screen.queryByText('Attachments:')).toBeNull();
        expect(link.getAttribute('href')).toBe('/store/objects/6a17fc9544c9629943624589');
        expect(link.getAttribute('data-document-id')).toBe('6a17fc9544c9629943624589');
        expect(screen.queryByText('[tokyo-tower_1 (1).jpg](/store/objects/6a17fc9544c9629943624589)')).toBeNull();
    });

    it('normalizes document attachment links to store object ids', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: ['review this', '', 'Attachments:', '[brief.pdf](document:doc-123)'].join('\n'),
                }),
            ],
            true,
            new Map(),
            {
                StoreLinkComponent: ({ href, documentId, children }) => (
                    <a href={href} data-document-id={documentId}>
                        {children}
                    </a>
                ),
            },
        );

        const link = screen.getByRole('link', { name: 'brief.pdf' });

        expect(link.getAttribute('href')).toBe('document:doc-123');
        expect(link.getAttribute('data-document-id')).toBe('doc-123');
    });

    it('renders uploaded image artifacts as attachments instead of raw markdown', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: [
                        'what is in this image?',
                        '',
                        '**Uploaded Artifacts:**',
                        '- [tokyo.png](artifact:files/tokyo.png) (image - use view_image tool)',
                    ].join('\n'),
                }),
            ],
            true,
        );

        expect(screen.getByText('what is in this image?')).not.toBeNull();
        expect(screen.getByText('tokyo.png')).not.toBeNull();
        expect(screen.queryByText(/Uploaded Artifacts/i)).toBeNull();
        expect(screen.queryByText(/\[tokyo\.png\]/)).toBeNull();
    });

    it('balances markdown table columns from their content size', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.ANSWER,
                    message: [
                        '| Requirement | Status | Evidence |',
                        '| --- | --- | --- |',
                        '| Hydrate existing app `appgen-6a23acdeac98748242db1da6` via `app_workspace_init` | ✅ | `hydrated_from_git.app_id = appgen-6a23acdeac98748242db1da6`, commit `2fc2f54` |',
                        '| Do NOT create a new app | ✅ | No `new_app: true` passed; workspace hydrated from git remote |',
                        '| Add concise subtitle under "Loan Pipeline" heading | ✅ | Replaced static `"Commercial loan origination dashboard"` with dynamic `"N applications · $X total pipeline value"` |',
                    ].join('\n'),
                }),
            ],
            true,
        );

        const columns = Array.from(screen.getByRole('table').querySelectorAll('col'));
        const contentWidths = [columns[0], columns[2]].map((column) =>
            Number.parseFloat(column.style.getPropertyValue('--agent-markdown-table-column-width')),
        );

        expect(columns).toHaveLength(3);
        expect(columns[1]?.classList.contains('agent-markdown-table-compact-col')).toBe(true);
        expect(contentWidths[1]).toBeGreaterThan(contentWidths[0]);
    });

    it('merges legacy activity progress rows with different tool run ids', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Build the app.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Running production build preflight...',
                    details: {
                        activity_group_id: 'activity-8',
                        tool: 'execute_shell',
                        tool_run_id: 'wrapper-run',
                        tool_status: 'running',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    message: '$ cd /home/daytona/src && pnpm run build completed successfully',
                    details: {
                        activity_group_id: 'activity-8',
                        tool: 'execute_shell',
                        tool_run_id: 'progress-run',
                        tool_status: 'completed',
                        output: 'Build output',
                    },
                }),
            ],
            true,
        );

        const workedRow = screen.getByRole('button', { name: /Worked\s*for\s*1s/ });
        fireEvent.click(workedRow);

        expect(screen.getByRole('button', { name: /Running production build preflight/ })).not.toBeNull();
        expect(screen.queryByRole('button', { name: /\$ cd \/home\/daytona\/src/ })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Running production build preflight/ }));

        expect(screen.getByText('$ cd /home/daytona/src && pnpm run build completed successfully')).not.toBeNull();
        expect(screen.getByText('Build output')).not.toBeNull();
        expect(screen.queryByText('Success')).toBeNull();
    });

    it('merges legacy plan update rows with the preceding update_plan tool row', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in France today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: "Updating the plan and performing a Google web search for today's headlines in France.",
                    details: {
                        event_class: 'activity',
                        tool: 'update_plan',
                        tool_run_id: 'update_plan',
                        tool_status: 'running',
                        tool_event: 'started',
                        activity_group_id: 'activity-4',
                        message_to_human:
                            "Updating the plan and performing a Google web search for today's headlines in France.",
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    type: AgentMessageType.UPDATE,
                    message: 'Updating 2 tasks of our plan.',
                    details: {
                        updates: [
                            { task_id: 1, status: 'completed' },
                            { task_id: 2, status: 'in_progress' },
                        ],
                    },
                }),
                makeMessage({
                    timestamp: 4_000,
                    type: AgentMessageType.PLAN,
                    message:
                        'Task 1 (Learn the web search skill) has been completed successfully. Now commencing Task 2.',
                    details: {
                        plan: [
                            { id: 1, goal: 'Learn the web search skill', status: 'completed' },
                            { id: 2, goal: "Search for today's headlines in France", status: 'in_progress' },
                        ],
                    },
                }),
            ],
            true,
        );

        fireEvent.click(screen.getByRole('button', { name: /Worked\s*for/ }));

        const planRow = screen.getByRole('button', {
            name: /Updating the plan and performing a Google web search/,
        });
        expect(planRow).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Updating 2 tasks of our plan/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Task 1 \(Learn the web search skill\)/ })).toBeNull();

        fireEvent.click(planRow);

        expect(screen.getByText('update_plan')).not.toBeNull();
        expect(screen.getByText('Started')).not.toBeNull();
        expect(screen.getByText('Ended')).not.toBeNull();
        expect(screen.getByText('Duration')).not.toBeNull();
    });

    it('copies expanded tool details without requiring the parent row click target', () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

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
            ],
            true,
        );

        fireEvent.click(screen.getByRole('button', { name: /Worked\s*for/ }));
        fireEvent.click(screen.getByRole('button', { name: /Japan news/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Copy tool details' }));

        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Tool: web_search_serper'));
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Found 5 results'));
    });

    it('does not expand tool error details by default', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Publish the app.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Publishing app...',
                    details: {
                        activity_group_id: 'activity-10',
                        tool: 'app_publish',
                        tool_run_id: 'publish-wrapper',
                        tool_status: 'running',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    type: AgentMessageType.ERROR,
                    message: 'App publish blocked until preview validation passes',
                    details: {
                        activity_group_id: 'activity-10',
                        tool: 'app_publish',
                        tool_run_id: 'publish-progress',
                        tool_status: 'error',
                    },
                }),
            ],
            true,
        );

        const workRow = screen.getByRole('button', { name: /Work needs attention\s*for\s*1s/ });
        fireEvent.click(workRow);

        const toolRow = screen.getByRole('button', { name: /Publishing app/ });
        expect(toolRow.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('App publish blocked until preview validation passes')).toBeNull();

        fireEvent.click(toolRow);

        expect(screen.getByText('App publish blocked until preview validation passes')).not.toBeNull();
    });

    it('renders pending ask options compactly in summary view', () => {
        renderSummary([
            makeMessage({
                timestamp: 1_000,
                type: AgentMessageType.REQUEST_INPUT,
                message: 'What is your favorite color?',
                details: {
                    ux: {
                        options: [
                            { id: 'red', label: 'Red', description: 'The color of fire and passion' },
                            { id: 'blue', label: 'Blue', description: 'The color of the sky and ocean' },
                        ],
                    },
                },
            }),
        ]);

        expect(screen.getByText('What is your favorite color?')).not.toBeNull();
        expect(screen.getByRole('button', { name: /Blue\s*The color of the sky and ocean/ })).not.toBeNull();
    });

    it('keeps only the ask question after the user answers in summary view', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.REQUEST_INPUT,
                    message: 'What is your favorite color?',
                    details: {
                        ux: {
                            options: [
                                { id: 'red', label: 'Red', description: 'The color of fire and passion' },
                                { id: 'blue', label: 'Blue', description: 'The color of the sky and ocean' },
                            ],
                        },
                    },
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.QUESTION,
                    message: 'blue',
                }),
            ],
            true,
        );

        expect(screen.getByText('What is your favorite color?')).not.toBeNull();
        expect(screen.getByText('blue')).not.toBeNull();
        expect(screen.queryByText('The color of the sky and ocean')).toBeNull();
        expect(screen.queryByRole('button', { name: /Blue/ })).toBeNull();
    });

    it('does not duplicate the initial request once the persisted user prompt is present', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Ask me what my favorite color is. give me choices',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.QUESTION,
                    message: 'green',
                }),
            ],
            true,
            new Map(),
            {
                initialRequestData: 'Ask me what my favorite color is. give me choices',
            },
        );

        expect(screen.getAllByText('Ask me what my favorite color is. give me choices')).toHaveLength(1);
        expect(screen.getByText('green')).not.toBeNull();
    });

    it('keeps only the ask question after the user answers in stacked view', () => {
        renderStacked([
            makeMessage({
                timestamp: 1_000,
                type: AgentMessageType.REQUEST_INPUT,
                message: 'What is your favorite color?',
                details: {
                    ux: {
                        options: [
                            { id: 'red', label: 'Red', description: 'The color of fire and passion' },
                            { id: 'blue', label: 'Blue', description: 'The color of the sky and ocean' },
                        ],
                    },
                },
            }),
            makeMessage({
                timestamp: 2_000,
                type: AgentMessageType.QUESTION,
                message: 'blue',
            }),
        ]);

        expect(screen.getByText('What is your favorite color?')).not.toBeNull();
        expect(screen.getByText('blue')).not.toBeNull();
        expect(screen.queryByText('The color of the sky and ocean')).toBeNull();
        expect(screen.queryByRole('button', { name: /Blue/ })).toBeNull();
    });

    it('renders thought prose as a collapsed subsection inside expanded work details', () => {
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

        expect(screen.queryByRole('button', { name: /Thought: The form source is better than the UI/ })).toBeNull();
        expect(
            screen.getByText('The form source is better than the UI, so I will inspect the serialization path.'),
        ).not.toBeNull();
        expect(screen.getByText('OAuthClientForm.tsx')).not.toBeNull();
        expect(screen.getByText('allowed_scopes')).not.toBeNull();
    });

    it('collapses very long thought prose inside expanded work details', () => {
        const longThought = [
            'Thinking through the best approach for this complex multi-repo release note generation problem...',
            '',
            'Grant is asking me to help design a prompt strategy for release notes from GitHub repos.',
            'This is a meta-task, so I need to help him think through the best approach and craft effective prompts.',
            '',
            'Key challenges:',
            '',
            '1. Multi-repo complexity: 3 repos with a dependency chain.',
            '2. Filtering logic: exclude chores and infrastructure changes unless user-facing.',
            '3. Deduplication: fixes and improvements should roll into the relevant feature.',
            '4. Progressive document building: preserve context without overloading a single step.',
            '5. Review loop: make sure final release notes are concise and audience-ready.',
            '',
            'Daily changelog approach has natural organization by time, but it creates rework.',
            'Feature list approach is more aligned with release notes, but needs stronger discovery.',
            'The best option is likely a hybrid: gather structured daily facts, then synthesize by feature.',
        ].join('\n');

        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'Plan release notes.',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.THOUGHT,
                    message: longThought,
                }),
                makeMessage({
                    timestamp: 3_000,
                    message: 'Reading commits',
                    details: {
                        tool: 'read_file',
                        tool_status: 'completed',
                        tool_run_id: 'tool-1',
                        path: 'CHANGELOG.md',
                    },
                }),
            ],
            true,
        );

        fireEvent.click(screen.getByRole('button', { name: /Worked\s*for/ }));

        const showMoreButton = screen.getByRole('button', { name: /Show more/ });
        const prose = screen.getByTestId('summary-thought-prose');
        expect(showMoreButton.getAttribute('aria-expanded')).toBe('false');
        expect(prose.getAttribute('class') ?? '').toContain('[-webkit-line-clamp:6]');
        expect(showMoreButton.getAttribute('class') ?? '').not.toContain('focus-visible:underline');
        expect(showMoreButton.getAttribute('class') ?? '').not.toContain('underline-offset');
        expect(Boolean(prose.compareDocumentPosition(showMoreButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        expect(screen.getByText(/Thinking through the best approach/)).not.toBeNull();
        expect(screen.getByText('CHANGELOG.md')).not.toBeNull();

        fireEvent.click(showMoreButton);

        const showLessButton = screen.getByRole('button', { name: /Show less/ });
        expect(showLessButton.getAttribute('aria-expanded')).toBe('true');
        expect(showLessButton.getAttribute('class') ?? '').not.toContain('sticky');
        expect(prose.getAttribute('class') ?? '').not.toContain('[-webkit-line-clamp:6]');
        expect(screen.getByText(/Feature list approach is more aligned/)).not.toBeNull();
    });

    it('renders legacy think tool rows as plain preamble prose in expanded summary work details', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in Tokyo today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Searching for the latest news headlines from Japan...',
                    details: {
                        event_class: 'activity',
                        tool: 'think',
                        tool_run_id: 'tool-1',
                        tool_use_id: 'tool-1',
                        tool_iteration: 1,
                        tool_status: 'running',
                        tool_event: 'started',
                        activity_group_id: 'activity-1',
                        message_to_human: 'Searching for the latest news headlines from Japan...',
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

        expect(screen.getByText('Searching for the latest news headlines from Japan...')).not.toBeNull();
        expect(
            screen.queryByRole('button', { name: /Thought: Searching for the latest news headlines from Japan/ }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: /Tool\s+Searching for/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Updating 1 tasks of our plan/ })).not.toBeNull();
    });

    it('renders long tool preambles as plain prose with show more inside expanded summary work details', () => {
        const longPreamble = [
            'I will now activate the web search skill so that I can look up live French news headlines.',
            'Then I will update the plan and proceed to search for current news headlines in France.',
            'After that I will compare French and international sources before giving a concise summary.',
            'This should keep the tool work visible without turning this preamble into a tool row.',
            'I will also keep the answer scoped to the current date and avoid stale coverage.',
            'Next I will verify that the sources are current enough for the requested headline summary.',
            'Finally I will present the findings as regular assistant prose instead of another tool row.',
        ].join('\n');

        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in France today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    type: AgentMessageType.THOUGHT,
                    message: longPreamble,
                    details: {
                        display_role: 'tool_preamble',
                        tools: ['learn_web_search'],
                        activity_group_id: 'activity-1',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    message: 'Activating the web search tool...',
                    details: {
                        event_class: 'activity',
                        tool: 'learn_web_search',
                        tool_run_id: 'tool-1',
                        tool_status: 'completed',
                        activity_group_id: 'activity-1',
                    },
                }),
            ],
            true,
        );

        fireEvent.click(screen.getByRole('button', { name: /Worked\s*for/ }));

        expect(screen.queryByText('Thought')).toBeNull();
        expect(screen.queryByRole('button', { name: /Thought:/ })).toBeNull();
        expect(screen.getByText(/I will now activate the web search skill/)).not.toBeNull();

        const showMoreButton = screen.getByRole('button', { name: /Show more/ });
        const prose = screen.getByTestId('summary-thought-prose');
        expect(showMoreButton.getAttribute('aria-expanded')).toBe('false');
        expect(prose.getAttribute('class') ?? '').toContain('[-webkit-line-clamp:6]');
        expect(Boolean(prose.compareDocumentPosition(showMoreButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        fireEvent.click(showMoreButton);

        const showLessButton = screen.getByRole('button', { name: /Show less/ });
        expect(showLessButton.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText(/This should keep the tool work visible/)).not.toBeNull();
    });

    it('does not collapse long tool preambles while the summary work row is active', () => {
        const longPreamble = [
            'I will now create a plan to retrieve the latest news headlines from France today.',
            'To do this, I will first activate the web search skill.',
            'Then I will search for current French news from multiple sources.',
            'After that I will retrieve and summarize the results.',
            'I will compare the current reports before answering.',
            'I will keep this setup visible while the work is still running.',
            'Finally I will produce a concise answer when the search completes.',
        ].join('\n');

        renderSummary([
            makeMessage({
                timestamp: Date.now() - 2_000,
                type: AgentMessageType.QUESTION,
                message: 'What are the news headlines in France today?',
            }),
            makeMessage({
                timestamp: Date.now() - 1_500,
                type: AgentMessageType.THOUGHT,
                message: longPreamble,
                details: {
                    display_role: 'tool_preamble',
                    tools: ['learn_web_search'],
                    activity_group_id: 'activity-1',
                },
            }),
            makeMessage({
                timestamp: Date.now() - 1_000,
                message: 'Creating a step-by-step plan to search for the latest headlines.',
                details: {
                    event_class: 'activity',
                    tool: 'update_plan',
                    tool_run_id: 'tool-1',
                    tool_status: 'running',
                    activity_group_id: 'activity-1',
                },
            }),
        ]);

        expect(screen.getByRole('button', { name: /Working\s*for/ }).getAttribute('aria-expanded')).toBe('true');
        expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Show less/ })).toBeNull();
        expect(screen.getByText(/Finally I will produce a concise answer/)).not.toBeNull();

        const prose = screen.getByTestId('summary-thought-prose');
        expect(prose.getAttribute('class') ?? '').not.toContain('[-webkit-line-clamp:6]');
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

    it('keeps a persisted streamed answer visible and closes work after idle', () => {
        renderSummary(
            [
                makeMessage({
                    timestamp: 1_000,
                    type: AgentMessageType.QUESTION,
                    message: 'What are the news headlines in Japan today?',
                }),
                makeMessage({
                    timestamp: 2_000,
                    message: 'Searching for current headlines',
                    details: {
                        tool: 'web_search_serper',
                        tool_status: 'completed',
                        tool_run_id: 'tool-1',
                        activity_group_id: 'activity-1',
                    },
                }),
                makeMessage({
                    timestamp: 3_000,
                    type: AgentMessageType.ANSWER,
                    message: 'Here are the top news headlines and key stories from Japan today.',
                    details: {
                        streamed: true,
                        activity_id: 'reply-1',
                    },
                }),
                makeMessage({
                    timestamp: 3_500,
                    type: AgentMessageType.IDLE,
                    message: 'Waiting for your command...',
                }),
            ],
            false,
        );

        expect(screen.getByText('Here are the top news headlines and key stories from Japan today.')).not.toBeNull();
        expect(screen.getByRole('button', { name: /Worked\s*for\s*1s/ })).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Working\s*for/ })).toBeNull();
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
