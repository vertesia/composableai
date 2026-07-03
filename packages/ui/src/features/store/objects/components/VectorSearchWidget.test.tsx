import { fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../__tests__/test-utils.js';
import { VectorSearchWidget } from './VectorSearchWidget';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            projects: {
                retrieve: vi.fn(),
            },
        },
        project: undefined,
    }),
}));

describe('VectorSearchWidget', () => {
    it('does not clear search on empty initial render or parent rerender', async () => {
        const initialOnChange = vi.fn();
        const nextOnChange = vi.fn();
        const { getByRole, rerender } = renderWithProviders(
            <VectorSearchWidget onChange={initialOnChange} refresh={0} />,
        );

        rerender(<VectorSearchWidget onChange={nextOnChange} refresh={0} />);

        expect(initialOnChange).not.toHaveBeenCalled();
        expect(nextOnChange).not.toHaveBeenCalled();

        fireEvent.change(getByRole('textbox'), { target: { value: 'tokyo tower' } });

        expect(nextOnChange).not.toHaveBeenCalled();

        fireEvent.change(getByRole('textbox'), { target: { value: '' } });

        await waitFor(() => {
            expect(nextOnChange).toHaveBeenCalledTimes(1);
        });
        expect(nextOnChange).toHaveBeenCalledWith(undefined);
    });
});
