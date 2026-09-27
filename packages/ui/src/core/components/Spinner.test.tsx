import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner, type SpinnerIconProps, SpinnerIconProvider } from './Spinner';

function CustomIcon({ className }: SpinnerIconProps) {
    return <span role="img" aria-label="Custom loading" className={className} />;
}

describe('SpinnerIconProvider', () => {
    it('preserves the standard spinner without an override', () => {
        render(<Spinner />);
        expect(screen.getByRole('img', { name: 'Loading' }).tagName.toLowerCase()).toBe('svg');
    });
    it('passes sizing and caller classes to the app icon', () => {
        render(
            <SpinnerIconProvider value={CustomIcon}>
                <Spinner size="lg" className="custom" />
            </SpinnerIconProvider>,
        );
        const icon = screen.getByRole('img', { name: 'Custom loading' });
        expect(icon.className).toContain('size-5');
        expect(icon.className).toContain('custom');
        expect(screen.queryByRole('img', { name: 'Loading' })).toBeNull();
    });
});
