import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../__tests__/test-utils.js';
import { Modal, ModalBody, ModalTitle } from './dialog.js';

describe('Modal', () => {
    it('moves focus into the dialog when it opens', async () => {
        function Harness() {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open modal
                    </button>
                    <Modal isOpen={open} onClose={() => setOpen(false)} noCloseButton>
                        <ModalTitle>Example modal</ModalTitle>
                        <ModalBody>
                            <input aria-label="Modal input" />
                        </ModalBody>
                    </Modal>
                </>
            );
        }

        renderWithProviders(<Harness />);
        const trigger = screen.getByRole('button', { name: 'Open modal' });
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = await screen.findByRole('dialog', { name: 'Example modal' });
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Modal input' }));
    });
});
