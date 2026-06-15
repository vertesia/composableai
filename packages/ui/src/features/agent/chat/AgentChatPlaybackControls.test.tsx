import { fireEvent, screen } from '@testing-library/react';
import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../__tests__/test-utils.js';
import { AgentChatPlaybackControls } from './AgentChatPlaybackControls';

function createMessage(index: number): AgentMessage {
    return {
        timestamp: Date.now() + index,
        workflow_run_id: 'agent-run-1',
        type: AgentMessageType.ANSWER,
        message: `message ${index}`,
        workstream_id: 'main',
    };
}

describe('AgentChatPlaybackControls', () => {
    const messages = [createMessage(1), createMessage(2), createMessage(3)];

    it('can jump from live playback to the first message', () => {
        const onChangeCursor = vi.fn();

        renderWithProviders(
            <AgentChatPlaybackControls cursor="live" messages={messages} onChangeCursor={onChangeCursor} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

        expect(onChangeCursor).toHaveBeenCalledWith(0);
    });

    it('can jump to the latest committed message', () => {
        const onChangeCursor = vi.fn();

        renderWithProviders(
            <AgentChatPlaybackControls cursor={0} messages={messages} onChangeCursor={onChangeCursor} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Jump to latest message' }));

        expect(onChangeCursor).toHaveBeenCalledWith(2);
    });

    it('scrubs directly to a message with the playback slider', () => {
        const onChangeCursor = vi.fn();

        renderWithProviders(
            <AgentChatPlaybackControls cursor={0} messages={messages} onChangeCursor={onChangeCursor} />,
        );

        const positionSlider = screen.getByRole('slider', { name: 'Playback position' });
        expect(positionSlider.getAttribute('aria-valuemin')).toBe('1');
        expect(positionSlider.getAttribute('aria-valuemax')).toBe('3');

        fireEvent.keyDown(positionSlider, { key: 'End' });

        expect(onChangeCursor).toHaveBeenCalledWith(2);
    });

    it('disables the slider for a single-message conversation', () => {
        const onChangeCursor = vi.fn();

        renderWithProviders(
            <AgentChatPlaybackControls cursor={0} messages={[createMessage(1)]} onChangeCursor={onChangeCursor} />,
        );

        const positionSlider = screen.getByRole('slider', { name: 'Playback position' });
        expect(positionSlider.getAttribute('aria-valuemin')).toBe('0');
        expect(positionSlider.getAttribute('aria-valuemax')).toBe('1');
        expect(positionSlider.hasAttribute('data-disabled')).toBe(true);
    });

    it('edits and clamps the playback position on blur without native number controls', () => {
        const onChangeCursor = vi.fn();

        renderWithProviders(
            <AgentChatPlaybackControls cursor={0} messages={messages} onChangeCursor={onChangeCursor} />,
        );

        const positionInput = screen.getByRole('textbox', { name: 'Playback position' });
        expect(positionInput.getAttribute('inputmode')).toBe('numeric');
        expect(positionInput.getAttribute('type')).toBe('text');

        fireEvent.change(positionInput, { target: { value: '2' } });
        expect(onChangeCursor).not.toHaveBeenCalled();

        fireEvent.blur(positionInput, { target: { value: '2' } });
        expect(onChangeCursor).toHaveBeenLastCalledWith(1);

        fireEvent.change(positionInput, { target: { value: '99' } });
        expect(onChangeCursor).toHaveBeenCalledTimes(1);

        fireEvent.blur(positionInput, { target: { value: '99' } });
        expect(onChangeCursor).toHaveBeenLastCalledWith(2);
    });
});
