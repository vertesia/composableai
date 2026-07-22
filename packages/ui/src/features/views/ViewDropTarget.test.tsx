import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { ContentObjectStatus, type ViewExecutionDefinition, type ViewExecutionResult } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { ViewDropTarget } from './ViewDropTarget.js';

vi.mock('../store/objects/upload/DocumentUploadModal.js', () => ({
    DocumentUploadModal: ({
        isOpen,
        files,
        collectionId,
        selectedFolder,
        initialTypeId,
        defaultProperties,
        allowFolders,
    }: {
        isOpen: boolean;
        files: File[];
        collectionId?: string;
        selectedFolder?: string;
        initialTypeId?: string;
        defaultProperties?: Record<string, unknown>;
        allowFolders?: boolean;
    }) =>
        isOpen ? (
            <div
                data-testid="upload-modal"
                data-collection-id={collectionId}
                data-location={selectedFolder}
                data-type-id={initialTypeId}
                data-properties={JSON.stringify(defaultProperties)}
                data-allow-folders={String(allowFolders)}
            >
                {files.map((file) => file.name).join(',')}
            </div>
        ) : null,
}));

const definition: ViewExecutionDefinition = {
    name: 'Inbox',
    results: {
        default_display: 'list',
        displays: [{ id: 'list', label: 'List', type: 'list', title: { field: 'name' } }],
        drop: {
            handler: 'upload',
            params: {
                type_id: 'invoice',
                collection_id: 'inbox',
                location: '/Inbox',
                properties: { source: 'view' },
                allow_folders: false,
            },
        },
    },
};

const result: ViewExecutionResult = {
    view: 'inbox',
    revision: 1,
    definition,
    display: 'list',
    search: { requested_mode: 'browse', applied_mode: 'browse', warnings: [] },
    hits: [
        {
            id: 'document-1',
            document: {
                id: 'document-1',
                name: 'Invoice',
                created_at: '2026-01-01T00:00:00.000Z',
                created_by: 'user-1',
                updated_at: '2026-01-01T00:00:00.000Z',
                updated_by: 'user-1',
                location: '/Inbox',
                status: ContentObjectStatus.completed,
                properties: {},
                revision: { root: 'document-1', head: true },
            },
        },
    ],
    total: 1,
    navigation: {},
    took: 1,
};

function dropFile(target: HTMLElement, name: string): File {
    const file = new File(['content'], name, { type: 'application/pdf' });
    fireEvent.drop(target, { dataTransfer: { files: [file] } });
    return file;
}

describe('ViewDropTarget', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('opens the built-in uploader for a JSON-configured upload drop', async () => {
        renderWithProviders(
            <ViewDropTarget definition={definition} request={{}} result={result} canWrite refresh={vi.fn()}>
                <div>View results</div>
            </ViewDropTarget>,
        );

        const target = screen.getByText('View results').parentElement;
        expect(target).not.toBeNull();
        dropFile(target as HTMLElement, 'invoice.pdf');

        const modal = await screen.findByTestId('upload-modal');
        expect(modal.textContent).toContain('invoice.pdf');
        expect(modal.dataset).toMatchObject({
            collectionId: 'inbox',
            location: '/Inbox',
            typeId: 'invoice',
            properties: '{"source":"view"}',
            allowFolders: 'false',
        });
    });

    it('runs a code contribution instead of the configured upload action', async () => {
        const run = vi.fn();
        renderWithProviders(
            <ViewDropTarget
                definition={definition}
                request={{ query: 'open invoices' }}
                result={result}
                contribution={{ run }}
                canWrite
                refresh={vi.fn()}
            >
                <div>View results</div>
            </ViewDropTarget>,
        );

        const target = screen.getByText('View results').parentElement;
        expect(target).not.toBeNull();
        const file = dropFile(target as HTMLElement, 'invoice.pdf');

        await waitFor(() => {
            expect(run).toHaveBeenCalledOnce();
            expect(run).toHaveBeenCalledWith(
                expect.objectContaining({
                    configuration: definition.results?.drop,
                    files: [file],
                    request: { query: 'open invoices' },
                }),
            );
        });
        expect(screen.queryByTestId('upload-modal')).toBeNull();
    });
});
