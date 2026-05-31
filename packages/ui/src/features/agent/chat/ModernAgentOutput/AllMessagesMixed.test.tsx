import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import AllMessagesMixed from './AllMessagesMixed';

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

function renderSummary(messages: AgentMessage[], isCompleted = false) {
    const bottomRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;

    return render(
        <I18nProvider lng="en">
            <AllMessagesMixed
                messages={messages}
                bottomRef={bottomRef}
                viewMode="sliding"
                isCompleted={isCompleted}
                artifactRunId="run-1"
            />
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
    });
});
