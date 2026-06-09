import { fireEvent, screen } from '@testing-library/react';
import { type ConversationFile, FileProcessingStatus } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../__tests__/test-utils.js';
import MessageInput from './MessageInput';

describe('MessageInput', () => {
    it('keeps document search and shortcut help inside the compact composer', async () => {
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

        fireEvent.pointerDown(screen.getByRole('button', { name: /Add attachment/i }));
        fireEvent.click(await screen.findByText('Attach Documents'));

        expect(renderDocumentSearch).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isOpen: true,
            }),
        );
    });

    it('keeps upload available while the composer is disabled by a running agent', () => {
        const onFilesSelected = vi.fn();
        const { container } = renderWithProviders(
            <MessageInput onSend={vi.fn()} onFilesSelected={onFilesSelected} disabled isStreaming />,
        );

        const menuTrigger = screen.getByRole('button', { name: /Add attachment/i });
        expect((menuTrigger as HTMLButtonElement).disabled).toBe(false);

        const input = container.querySelector('input[type="file"]');
        const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
        if (!input) {
            throw new Error('Expected hidden file input to be rendered');
        }

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });

    it('accepts dropped files when upload is enabled', () => {
        const onFilesSelected = vi.fn();
        const { container } = renderWithProviders(<MessageInput onSend={vi.fn()} onFilesSelected={onFilesSelected} />);
        const dropTarget = container.firstElementChild;
        const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

        if (!dropTarget) {
            throw new Error('Expected composer drop target to be rendered');
        }

        fireEvent.dragOver(dropTarget, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(screen.getByText('Drop files to upload')).not.toBeNull();

        fireEvent.drop(dropTarget, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });

    it('does not show a local drop area when parent drag handling is enabled', () => {
        const onFilesSelected = vi.fn();
        const { container } = renderWithProviders(
            <MessageInput onSend={vi.fn()} onFilesSelected={onFilesSelected} disableDropZone />,
        );
        const dropTarget = container.firstElementChild;
        const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

        if (!dropTarget) {
            throw new Error('Expected composer drop target to be rendered');
        }

        fireEvent.dragOver(dropTarget, {
            dataTransfer: {
                files: [file],
            },
        });
        fireEvent.drop(dropTarget, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(screen.queryByText('Drop files to upload')).toBeNull();
        expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it('allows removing a processed file chip', () => {
        const onRemoveFile = vi.fn();
        const processingFiles = new Map<string, ConversationFile>([
            [
                'file-1',
                {
                    id: 'file-1',
                    name: 'wrong.png',
                    content_type: 'image/png',
                    size: 1,
                    status: FileProcessingStatus.READY,
                    started_at: 1_000,
                },
            ],
        ]);

        renderWithProviders(
            <MessageInput
                onSend={vi.fn()}
                onFilesSelected={vi.fn()}
                processingFiles={processingFiles}
                onRemoveFile={onRemoveFile}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Remove wrong.png/i }));

        expect(onRemoveFile).toHaveBeenCalledWith('file-1');
    });

    it('renders image processing files as thumbnails when a preview URL is available', () => {
        const processingFiles = new Map<string, ConversationFile>([
            [
                'file-1',
                {
                    id: 'file-1',
                    name: 'wrong.png',
                    content_type: 'image/png',
                    size: 1,
                    status: FileProcessingStatus.READY,
                    started_at: 1_000,
                    preview_url: 'blob:wrong',
                } as ConversationFile & { preview_url: string },
            ],
        ]);

        renderWithProviders(
            <MessageInput
                onSend={vi.fn()}
                onFilesSelected={vi.fn()}
                processingFiles={processingFiles}
                onRemoveFile={vi.fn()}
            />,
        );

        expect(screen.getByRole('img', { name: 'wrong.png' })).not.toBeNull();
        expect(screen.getByText('Ready')).not.toBeNull();
    });
});
