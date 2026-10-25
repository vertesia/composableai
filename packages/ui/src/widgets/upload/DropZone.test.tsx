// @vitest-environment jsdom

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { DropZone } from './DropZone.js';

describe('DropZone', () => {
    it('handles a dropped file without propagating it to a parent drop target', () => {
        const onDrop = vi.fn();
        const onParentDrop = vi.fn();
        const file = new File(['content'], 'document.txt', { type: 'text/plain' });

        renderWithProviders(
            <section aria-label="Parent drop target" onDrop={onParentDrop}>
                <DropZone onDrop={onDrop} message="Drop files here" allowFolders={false} />
            </section>,
        );

        const dropZone = screen.getByText('Drop files here').parentElement;
        expect(dropZone).not.toBeNull();
        fireEvent.drop(dropZone as HTMLElement, { dataTransfer: { files: [file] } });

        expect(onDrop).toHaveBeenCalledOnce();
        expect(onDrop).toHaveBeenCalledWith([file]);
        expect(onParentDrop).not.toHaveBeenCalled();
    });
});
