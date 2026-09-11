import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AgentRunFeedbackPayload, AgentRunFeedbackStatus } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
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
