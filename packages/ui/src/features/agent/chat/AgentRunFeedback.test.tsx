import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AgentRunFeedbackPayload, AgentRunFeedbackStatus } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import englishMessages from '../../../i18n/locales/en.json' with { type: 'json' };
import { AgentRunFeedback, agentRunFeedbackReasonCodes } from './AgentRunFeedback';

const mocks = vi.hoisted(() => ({ recordFeedback: vi.fn() }));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ client: { agents: { recordFeedback: mocks.recordFeedback } } }),
}));

function respondWith(...statuses: AgentRunFeedbackStatus[]) {
    for (const status of statuses) {
        mocks.recordFeedback.mockResolvedValueOnce({ status });
    }
}

function payloadOf(call: number): AgentRunFeedbackPayload {
    return mocks.recordFeedback.mock.calls[call][1] as AgentRunFeedbackPayload;
}

describe('AgentRunFeedback', () => {
    beforeEach(() => {
        mocks.recordFeedback.mockReset();
    });

    it('records the rating on the click itself, before asking for any detail', async () => {
        // The rating is the signal being collected; requiring a form first would cost most of it.
        respondWith('recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(1));
        expect(mocks.recordFeedback).toHaveBeenCalledWith('run-1', { rating: 'up' });

        // Dismissing the detail dialog keeps the bare rating: it was already written.
        await screen.findByText('Tell us more');
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true'),
        );
        expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
    });

    it('drops the previous run’s rating when the run it is showing changes', async () => {
        // The control is exported from `@vertesia/ui` and cannot assume its parent keys it by run.
        // Without an internal reset the lit thumb followed the user into the next conversation.
        respondWith('recorded');
        const { rerender } = renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));
        // The dialog takes the page out of the a11y tree, so dismiss it before reading the thumb.
        await screen.findByText('Tell us more');
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true'),
        );

        rerender(<AgentRunFeedback agentRunId="run-2" />);

        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe('false');
        // And the detail dialog does not survive the switch carrying the old run's draft.
        expect(screen.queryByText('Tell us more')).toBeNull();
    });

    it('does not send a comment written about one run against another', async () => {
        // `send` reads `agentRunId` at call time, so a dialog left open across a switch submitted
        // the previous run's text under the new run's id.
        respondWith('recorded', 'recorded');
        const { rerender } = renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        await screen.findByText('Tell us more');
        fireEvent.change(screen.getByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: 'this was about run one' },
        });

        rerender(<AgentRunFeedback agentRunId="run-2" />);

        // The dialog is gone, so there is nothing left to submit the stale draft from.
        expect(screen.queryByText('Tell us more')).toBeNull();
        expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
        expect(mocks.recordFeedback).toHaveBeenCalledWith('run-1', { rating: 'down' });
    });

    it('sends the reason and comment as a revision of the same rating', async () => {
        respondWith('recorded', 'recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        await screen.findByText('Tell us more');

        fireEvent.change(screen.getByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: '  it deleted the wrong collection  ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(2));
        expect(payloadOf(1)).toEqual({ rating: 'down', comment: 'it deleted the wrong collection' });
    });

    it('carries the message identifiers when a single message is rated', async () => {
        respondWith('recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" messageId="m-7" messageSeq={7} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this answer up' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(1));
        expect(payloadOf(0)).toEqual({ rating: 'up', message_id: 'm-7', message_seq: 7 });
    });

    it('does not claim a rating that the server said it dropped', async () => {
        // `no_diagnosis` answers 200 like a success. Showing the thumb as selected would tell the
        // user their rating counted when nothing was written.
        respondWith('no_diagnosis');
        const onRecorded = vi.fn();
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" onRecorded={onRecorded} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ rating: 'up' }, 'no_diagnosis'));
        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.queryByText('Tell us more')).toBeNull();
    });

    it('keeps offering itself when the run is between episodes', async () => {
        // `episode_unavailable` is the one non-recorded status worth another click: the run IS in an
        // episode, we just do not know which one yet. Removing the control (as `disabled` does) or
        // lighting the thumb (as `recorded` does) would both be wrong.
        respondWith('episode_unavailable');
        const onRecorded = vi.fn();
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" onRecorded={onRecorded} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ rating: 'up' }, 'episode_unavailable'));
        const button = await screen.findByRole('button', { name: 'Rate this run up' });
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(screen.queryByText('Tell us more')).toBeNull();
        // The message itself goes out as a toast, which renders through a provider this harness
        // does not mount; what is checkable here is that the status the server sent has a message
        // at all — a missing key would surface to the user as the raw status string.
        expect(englishMessages['agent.feedback.status.episode_unavailable']).toBe(
            'This run is between tasks. Try again in a moment.',
        );
    });

    it('sends the detail to the episode the thumb landed on, not to whichever one is current', async () => {
        // Identity is separate from revision: the episode usually CLOSES between the two
        // submissions, and re-resolving would file the reason code on the next one.
        mocks.recordFeedback.mockResolvedValueOnce({ status: 'recorded', episode_seq: 4 });
        mocks.recordFeedback.mockResolvedValueOnce({ status: 'recorded', episode_seq: 4, revision: 3 });
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        await screen.findByText('Tell us more');
        fireEvent.change(screen.getByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: 'it stopped halfway' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(2));
        // The first submission does not name an episode — it is what ASKS which episode this is.
        expect(payloadOf(0)).toEqual({ rating: 'down' });
        expect(payloadOf(1)).toEqual({ rating: 'down', comment: 'it stopped halfway', episode_seq: 4 });
    });

    it('stops offering itself once the deployment says ratings are not collected', async () => {
        respondWith('disabled');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: 'Rate this run up' })).toBeNull());
    });

    it('keeps the control usable after a network failure', async () => {
        mocks.recordFeedback.mockRejectedValueOnce(new Error('boom'));
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(1));
        const button = (await screen.findByRole('button', { name: 'Rate this run down' })) as HTMLButtonElement;
        await waitFor(() => expect(button.disabled).toBe(false));
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('offers every reason code the API accepts, on the side it belongs to', () => {
        // A code the picker never offers is a code the warehouse never counts.
        expect(agentRunFeedbackReasonCodes('up')).toEqual(['accurate', 'helpful', 'fast', 'well_explained', 'other']);
        expect(agentRunFeedbackReasonCodes('down')).toEqual([
            'wrong_result',
            'incomplete',
            'misunderstood_request',
            'too_slow',
            'tool_failure',
            'unsafe_action',
            'other',
        ]);
    });
});
