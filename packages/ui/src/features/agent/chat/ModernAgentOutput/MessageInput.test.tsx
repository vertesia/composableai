import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../__tests__/test-utils.js';
import MessageInput from './MessageInput';

describe('MessageInput', () => {
    it('keeps document search and shortcut help inside the compact composer', () => {
        const renderDocumentSearch = vi.fn(() => null);

        renderWithProviders(
            <MessageInput
                onSend={vi.fn()}
                renderDocumentSearch={renderDocumentSearch}
                selectedDocuments={[{ id: 'doc-1', name: 'Loan package' }]}
                isCompleted
            />,
        );

        expect(screen.getByPlaceholderText(/Enter to send/)).not.toBeNull();
        expect(screen.queryByText('Enter to send • Shift+Enter for new line')).toBeNull();
        expect(screen.getByText('Loan package')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Search Documents/i }));

        expect(renderDocumentSearch).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isOpen: true,
            }),
        );
    });
});
