import { fireEvent, render, screen } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { AgentChatFixtureReplay, type AgentChatReplayFixture } from './AgentChatFixtureReplay';

vi.mock('./ModernAgentOutput/AllMessagesMixed', () => ({
    default: ({
        messages,
        streamingMessages,
        viewMode,
        renderRequestInputControls,
    }: {
        messages: AgentMessage[];
        streamingMessages: Map<string, unknown>;
        viewMode: string;
        renderRequestInputControls?: boolean;
    }) => (
        <div
            data-testid="all-messages-mixed"
            data-message-count={messages.length}
            data-view-mode={viewMode}
            data-render-request-input-controls={renderRequestInputControls}
        >
            <div data-testid="fixture-rendered-count">{messages.length}</div>
            <div data-testid="fixture-streaming-count">{streamingMessages.size}</div>
        </div>
    ),
}));

function message(type: AgentMessageType, text: string, timestamp: number): AgentMessage {
    return {
        timestamp,
        workflow_run_id: 'run-1',
        type,
        message: text,
        workstream_id: 'main',
    };
}

function renderReplay(
    fixture: AgentChatReplayFixture,
    props: Omit<ComponentProps<typeof AgentChatFixtureReplay>, 'fixture'> = {},
) {
    return render(
        <I18nProvider lng="en">
            <AgentChatFixtureReplay fixture={fixture} {...props} />
        </I18nProvider>,
    );
}

describe('AgentChatFixtureReplay', () => {
    it('renders the normal summary chat view by default', () => {
        renderReplay({
            messages: [message(AgentMessageType.QUESTION, 'first', 1)],
        });

        expect(screen.getByTestId('all-messages-mixed').getAttribute('data-view-mode')).toBe('sliding');
    });

    it('can hide the fixture replay header', () => {
        renderReplay(
            {
                messages: [message(AgentMessageType.QUESTION, 'first', 1)],
                metadata: {
                    title: 'Fixture title',
                },
            },
            { showHeader: false },
        );

        expect(screen.queryByText('Fixture title')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Download Messages' })).toBeNull();
        expect(screen.getByRole('slider', { name: 'Playback position' })).not.toBeNull();
    });

    it('steps through fixture messages without mutating the source fixture', () => {
        const fixture: AgentChatReplayFixture = {
            messages: [
                message(AgentMessageType.QUESTION, 'first', 1),
                message(AgentMessageType.ANSWER, 'second', 2),
                message(AgentMessageType.COMPLETE, 'done', 3),
            ],
        };
        const originalMessages = [...fixture.messages];

        renderReplay(fixture);

        expect(screen.getByTestId('fixture-rendered-count').textContent).toBe('1');
        fireEvent.click(screen.getByRole('button', { name: 'Next message' }));
        expect(screen.getByTestId('fixture-rendered-count').textContent).toBe('2');
        fireEvent.click(screen.getByRole('button', { name: 'Next message' }));
        expect(screen.getByTestId('fixture-rendered-count').textContent).toBe('3');
        fireEvent.click(screen.getByRole('button', { name: 'Next message' }));
        expect(screen.getByTestId('fixture-rendered-count').textContent).toBe('3');
        expect(fixture.messages).toEqual(originalMessages);
    });

    it('renders streaming frames for the matching cursor', () => {
        renderReplay({
            messages: [message(AgentMessageType.QUESTION, 'first', 1), message(AgentMessageType.ANSWER, 'second', 2)],
            streamingFrames: [
                {
                    cursor: 0,
                    streamingMessages: [{ id: 'stream-1', text: 'live', startTimestamp: 1 }],
                },
            ],
        });

        expect(screen.getByTestId('fixture-streaming-count').textContent).toBe('1');
        fireEvent.click(screen.getByRole('button', { name: 'Next message' }));
        expect(screen.getByTestId('fixture-streaming-count').textContent).toBe('0');
    });

    it('moves pending ask controls into the bottom overlay and advances replay on selection', () => {
        renderReplay({
            messages: [
                {
                    ...message(AgentMessageType.REQUEST_INPUT, 'What is your favorite color?', 1),
                    details: {
                        ux: {
                            options: [
                                { id: 'red', label: 'Red' },
                                { id: 'blue', label: 'Blue' },
                            ],
                        },
                    },
                },
                message(AgentMessageType.QUESTION, 'blue', 2),
            ],
        });

        expect(screen.getByTestId('all-messages-mixed').getAttribute('data-render-request-input-controls')).toBe(
            'false',
        );
        fireEvent.click(screen.getByRole('button', { name: /Blue/ }));

        expect(screen.getByTestId('fixture-rendered-count').textContent).toBe('2');
        expect(screen.getByTestId('all-messages-mixed').getAttribute('data-render-request-input-controls')).toBe(
            'true',
        );
    });
});
