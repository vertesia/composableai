import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoTip } from './InfoTip';

describe('InfoTip', () => {
    // The point of the null return: call sites forward an optional `description`
    // straight through, so an unset one must leave nothing behind — not a bare icon,
    // and not an empty flex item that opens a gap beside the label or heading.
    it('renders nothing without a description', () => {
        const { container } = render(<InfoTip />);
        expect(container.innerHTML).toBe('');
    });

    it('renders nothing for an empty description', () => {
        const { container } = render(<InfoTip description="" />);
        expect(container.innerHTML).toBe('');
    });

    it('renders a focusable trigger when a description is set', () => {
        render(<InfoTip description="What this field does" />);
        expect(screen.getByRole('button')).toBeDefined();
    });

    it('uses the larger icon for the md size', () => {
        const { container } = render(<InfoTip description="Heading help" size="md" />);
        expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-4');
    });

    it('defaults to the small icon', () => {
        const { container } = render(<InfoTip description="Label help" />);
        expect(container.querySelector('svg')?.getAttribute('class')).toContain('size-3');
    });
});
