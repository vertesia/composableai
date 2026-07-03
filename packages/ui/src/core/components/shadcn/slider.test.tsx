import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Slider } from './slider';

describe('Slider', () => {
    it('keeps the thumb mounted when a controlled value changes', () => {
        const { rerender } = render(<Slider aria-label="Playback position" min={1} max={10} value={[1]} />);
        const thumb = screen.getByRole('slider', { name: 'Playback position' });

        rerender(<Slider aria-label="Playback position" min={1} max={10} value={[5]} />);

        expect(screen.getByRole('slider', { name: 'Playback position' })).toBe(thumb);
    });
});
