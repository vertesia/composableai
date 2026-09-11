import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AgentRunFeedbackEntry, AgentRunFeedbackPayload, AgentRunFeedbackStatus } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { AgentRunFeedback, AgentRunFeedbackProvider, agentRunFeedbackReasonCodes } from './AgentRunFeedback';

const mocks = vi.hoisted(() => {
    const recordFeedback = vi.fn();
    const retrieve = vi.fn();
    // One session object for the whole file: the real session is stable across renders, and the
    // provider reads the run again only when the client or the user changes.
    const session = { client: { agents: { recordFeedback, retrieve } }, user: { sub: 'me' } };
    return { recordFeedback, retrieve, session };
});

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => mocks.session,
}));

function entry(overrides: Partial<AgentRunFeedbackEntry>): AgentRunFeedbackEntry {
    return {
        feedback_id: 'fb',
        rating: 'up',
        message_scoped: false,
        user_id: 'user:me',
        rated_at: '2026-09-11T10:00:00.000Z',
        ...overrides,
    };
}

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
        mocks.retrieve.mockReset();
    });

    it('records the rating on the click itself, before asking for any detail', async () => {
        // The rating is the signal being collected; requiring a form first would cost most of it.
        respondWith('recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(1));
        expect(mocks.recordFeedback).toHaveBeenCalledWith('run-1', { feedback_id: expect.any(String), rating: 'up' });

        // Nothing opens on its own: the thumb lights and a quiet "Tell us more" link appears.
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true'),
        );
        expect(screen.queryByPlaceholderText('What went well, or what went wrong?')).toBeNull();
        expect(screen.getByRole('button', { name: 'Tell us more' })).toBeTruthy();
        expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
    });

    it('offers the detail dialog only behind the "Tell us more" link', async () => {
        respondWith('recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        expect(screen.queryByRole('button', { name: 'Tell us more' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Tell us more' }));

        await screen.findByPlaceholderText('What went well, or what went wrong?');
        // Dismissing the dialog keeps the bare rating: it was already written.
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
        await waitFor(() => expect(screen.queryByPlaceholderText('What went well, or what went wrong?')).toBeNull());
        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true');
        expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
    });

    it('drops the previous run’s rating when the run it is showing changes', async () => {
        // The control is exported from `@vertesia/ui` and cannot assume its parent keys it by run.
        // Without an internal reset the lit thumb followed the user into the next conversation.
        respondWith('recorded');
        const { rerender } = renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true'),
        );

        rerender(<AgentRunFeedback agentRunId="run-2" />);

        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe('false');
        // And the "Tell us more" link does not survive the switch: there is no rating to add to.
        expect(screen.queryByRole('button', { name: 'Tell us more' })).toBeNull();
    });

    it('does not send a comment written about one run against another', async () => {
        // `send` reads `agentRunId` at call time, so a dialog left open across a switch submitted
        // the previous run's text under the new run's id.
        respondWith('recorded', 'recorded');
        const { rerender } = renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Tell us more' }));
        fireEvent.change(await screen.findByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: 'this was about run one' },
        });

        rerender(<AgentRunFeedback agentRunId="run-2" />);

        // The dialog is gone, so there is nothing left to submit the stale draft from.
        expect(screen.queryByPlaceholderText('What went well, or what went wrong?')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Tell us more' })).toBeNull();
        expect(mocks.recordFeedback).toHaveBeenCalledTimes(1);
        expect(mocks.recordFeedback).toHaveBeenCalledWith('run-1', {
            feedback_id: expect.any(String),
            rating: 'down',
        });
    });

    it('sends the reason and comment as a revision of the same rating', async () => {
        respondWith('recorded', 'recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Tell us more' }));

        fireEvent.change(await screen.findByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: '  it deleted the wrong collection  ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(2));
        expect(payloadOf(1)).toEqual({
            feedback_id: expect.any(String),
            rating: 'down',
            comment: 'it deleted the wrong collection',
        });
    });

    it('carries the message identifiers when a single message is rated', async () => {
        respondWith('recorded');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" messageId="m-7" messageSeq={7} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this answer up' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(1));
        expect(payloadOf(0)).toEqual({
            feedback_id: expect.any(String),
            rating: 'up',
            message_id: 'm-7',
            message_seq: 7,
        });
    });

    it('treats a replaced rating as accepted', async () => {
        // A second vote by the same user on the same scope supersedes the first server-side; the
        // rating is in, so the thumb lights and "Tell us more" is offered exactly as for `recorded`.
        respondWith('replaced');
        const onRecorded = vi.fn();
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" onRecorded={onRecorded} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));

        await waitFor(() =>
            expect(onRecorded).toHaveBeenCalledWith({ feedback_id: expect.any(String), rating: 'down' }, 'replaced'),
        );
        await screen.findByRole('button', { name: 'Tell us more' });
        expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('gives every submission its own idempotency key', async () => {
        // The bare rating and its detail revision are two requests; a retry of either must not
        // count twice, and the server tells them apart by `feedback_id`.
        respondWith('recorded', 'replaced');
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Tell us more' }));
        fireEvent.change(await screen.findByPlaceholderText('What went well, or what went wrong?'), {
            target: { value: 'it stopped halfway' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        await waitFor(() => expect(mocks.recordFeedback).toHaveBeenCalledTimes(2));
        expect(payloadOf(0).feedback_id).toEqual(expect.any(String));
        expect(payloadOf(1).feedback_id).toEqual(expect.any(String));
        expect(payloadOf(1).feedback_id).not.toBe(payloadOf(0).feedback_id);
        expect(payloadOf(1)).toMatchObject({ rating: 'down', comment: 'it stopped halfway' });
    });

    it('stops offering itself once the deployment says ratings are not collected', async () => {
        respondWith('disabled');
        const onRecorded = vi.fn();
        renderWithProviders(<AgentRunFeedback agentRunId="run-1" onRecorded={onRecorded} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run up' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: 'Rate this run up' })).toBeNull());
        // Nothing was recorded, so the "recorded" callback does not fire.
        expect(onRecorded).not.toHaveBeenCalled();
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

    it('shows the rating the user already gave once the run is read back', async () => {
        // The thumbs used to live only in component memory: a reload of the conversation showed
        // them blank while the run list already carried the rating. The provider reads the run's
        // retained entries once and every control under it picks up its own scope.
        mocks.retrieve.mockResolvedValue({
            feedback: [
                entry({ feedback_id: 'a', rating: 'down', message_scoped: true, message_id: 'main:1' }),
                entry({ feedback_id: 'b', rating: 'up' }),
            ],
        });
        renderWithProviders(
            <AgentRunFeedbackProvider agentRunId="run-1">
                <AgentRunFeedback agentRunId="run-1" messageId="main:1" />
                <AgentRunFeedback agentRunId="run-1" />
            </AgentRunFeedbackProvider>,
        );

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this answer down' }).getAttribute('aria-pressed')).toBe(
                'true',
            ),
        );
        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: 'Rate this answer up' }).getAttribute('aria-pressed')).toBe('false');
        // A stored rating is a rating: the detail link is offered on it too.
        expect(screen.getAllByRole('button', { name: 'Tell us more' })).toHaveLength(2);
        expect(mocks.retrieve).toHaveBeenCalledTimes(1);
        expect(mocks.recordFeedback).not.toHaveBeenCalled();
    });

    it('ignores other raters, superseded entries and unrelated scopes when reading the run back', async () => {
        mocks.retrieve.mockResolvedValue({
            feedback: [
                entry({ feedback_id: 'theirs', rating: 'up', user_id: 'user:someone-else' }),
                entry({ feedback_id: 'old', rating: 'up', replaced_at: '2026-09-11T10:01:00.000Z' }),
                entry({ feedback_id: 'other-message', rating: 'up', message_scoped: true, message_id: 'main:2' }),
                entry({ feedback_id: 'first', rating: 'up', rated_at: '2026-09-11T09:00:00.000Z' }),
                entry({ feedback_id: 'latest', rating: 'down', rated_at: '2026-09-11T10:00:00.000Z' }),
            ],
        });
        renderWithProviders(
            <AgentRunFeedbackProvider agentRunId="run-1">
                <AgentRunFeedback agentRunId="run-1" />
            </AgentRunFeedbackProvider>,
        );

        await waitFor(() => expect(mocks.retrieve).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe(
                'true',
            ),
        );
        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('lets a click made now win over the stored rating, and keeps it for a remounted control', async () => {
        mocks.retrieve.mockResolvedValue({ feedback: [entry({ rating: 'up' })] });
        respondWith('replaced');
        const { rerender } = renderWithProviders(
            <AgentRunFeedbackProvider agentRunId="run-1">
                <AgentRunFeedback agentRunId="run-1" key="a" />
            </AgentRunFeedbackProvider>,
        );
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('true'),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Rate this run down' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe(
                'true',
            ),
        );

        // A fresh control for the same scope (the message list re-keyed, say) shows the new vote,
        // not the one the run document held when it was read.
        rerender(
            <AgentRunFeedbackProvider agentRunId="run-1">
                <AgentRunFeedback agentRunId="run-1" key="b" />
            </AgentRunFeedbackProvider>,
        );
        expect(screen.getByRole('button', { name: 'Rate this run down' }).getAttribute('aria-pressed')).toBe('true');
        expect(mocks.retrieve).toHaveBeenCalledTimes(1);
    });

    it('starts blank when the run cannot be read back', async () => {
        mocks.retrieve.mockRejectedValue(new Error('403'));
        renderWithProviders(
            <AgentRunFeedbackProvider agentRunId="run-1">
                <AgentRunFeedback agentRunId="run-1" />
            </AgentRunFeedbackProvider>,
        );
        await waitFor(() => expect(mocks.retrieve).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('button', { name: 'Rate this run up' }).getAttribute('aria-pressed')).toBe('false');
        expect(screen.queryByRole('button', { name: 'Tell us more' })).toBeNull();
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
