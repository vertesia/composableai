import { fireEvent, screen, within } from '@testing-library/react';
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

        expect(screen.getByPlaceholderText(/Type your message/)).not.toBeNull();
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

    it('renders attachment actions before the MCP slot', () => {
        renderWithProviders(<MessageInput onSend={vi.fn()} mcpSlot={<button type="button">MCP</button>} isCompleted />);

        const attachmentButton = screen.getByRole('button', { name: /Add attachment/i });
        const mcpButton = screen.getByRole('button', { name: 'MCP' });

        expect(attachmentButton.compareDocumentPosition(mcpButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    it('renders context usage and triggers manual compaction', async () => {
        const onCompactContext = vi.fn();

        renderWithProviders(
            <MessageInput
                onSend={vi.fn()}
                contextWindowUsage={{
                    usedTokens: 50_000,
                    checkpointTokens: 100_000,
                    usedPercent: 50,
                    remainingPercent: 50,
                }}
                onCompactContext={onCompactContext}
                isStreaming
            />,
        );

        const contextButton = screen.getByRole('button', { name: /50% context used/i });

        fireEvent.pointerMove(contextButton);

        expect((await screen.findAllByText('Context size: 50K / 100K tokens')).length).toBeGreaterThan(0);

        fireEvent.click(contextButton);

        expect(onCompactContext).toHaveBeenCalledTimes(1);
    });

    it('shows active workstream names above the compact composer', () => {
        renderWithProviders(
            <MessageInput
                onSend={vi.fn()}
                isStreaming
                activeWorkstreams={[
                    {
                        workstream_id: 'qa_tasks',
                        launch_id: 'launch-1',
                        elapsed_ms: 0,
                        deadline_ms: 0,
                        remaining_ms: 0,
                        status: 'running',
                    },
                    {
                        workstream_id: 'qa_assignee',
                        launch_id: 'launch-2',
                        elapsed_ms: 0,
                        deadline_ms: 0,
                        remaining_ms: 0,
                        status: 'running',
                        phase: 'browser_use',
                    },
                ]}
            />,
        );

        const tray = document.querySelector('[data-agent-active-workstreams]');
        if (!(tray instanceof HTMLElement)) {
            throw new Error('Expected active workstream tray to be rendered');
        }

        expect(within(tray).getByText('Agent has 2 active workstreams running')).not.toBeNull();
        expect(within(tray).getByText('QA Tasks')).not.toBeNull();
        expect(within(tray).getByText('QA Assignee')).not.toBeNull();
        expect(within(tray).getByText('Browser Use')).not.toBeNull();
        expect(
            tray.compareDocumentPosition(screen.getByRole('textbox')) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
