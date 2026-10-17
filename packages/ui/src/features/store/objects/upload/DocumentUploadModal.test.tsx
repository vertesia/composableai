import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContentObjectTypeCatalogEntry } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { DocumentUploadModal } from './DocumentUploadModal.js';
import { FileUploadAction, type FileWithMetadata } from './useSmartFileUploadProcessing.js';

const mocks = vi.hoisted(() => ({
    registry: undefined as
        | { types: ContentObjectTypeCatalogEntry[]; getType: (id: string) => ContentObjectTypeCatalogEntry | undefined }
        | undefined,
    process: vi.fn<(files: File[]) => Promise<FileWithMetadata[]>>(),
    toast: vi.fn(),
    client: { store: { collections: { retrieve: vi.fn() } } },
}));

vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => ({ client: mocks.client }) }));
vi.mock('../../types/TypeRegistryProvider.js', () => ({ useTypeRegistry: () => ({ registry: mocks.registry }) }));
vi.mock('./useSmartFileUploadProcessing.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./useSmartFileUploadProcessing.js')>()),
    useSmartFileUploadProcessing: () => ({ checkDocumentProcessing: mocks.process }),
}));
vi.mock('@vertesia/ui/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@vertesia/ui/core')>()),
    useToast: () => mocks.toast,
}));
vi.mock('@vertesia/ui/widgets', () => ({
    DropZone: ({ onDrop }: { onDrop: (files: File[]) => void }) => (
        <input
            aria-label="Select files"
            type="file"
            multiple
            onChange={(event) => onDrop(Array.from(event.target.files ?? []))}
        />
    ),
    UploadSummary: () => null,
}));

const files = [new File(['document'], 'document.md'), new File(['image'], 'image.png')];
const type: ContentObjectTypeCatalogEntry = { id: 'invoice', name: 'Invoice' };
function registry() {
    return { types: [type], getType: (id: string) => (id === type.id ? type : undefined) };
}
function modal(isOpen = true, initialTypeId?: string) {
    return (
        <I18nProvider lng="en">
            <DocumentUploadModal isOpen={isOpen} onClose={vi.fn()} initialTypeId={initialTypeId} />
        </I18nProvider>
    );
}
async function chooseFiles() {
    fireEvent.change(await screen.findByLabelText('Select files'), { target: { files } });
}
async function expectAnalysis() {
    await screen.findByRole('heading', { name: /File Analysis Results/ });
    await waitFor(() => expect(screen.getByText('2 files')).toBeTruthy());
    expect(screen.getByText('2 files are ready to process')).toBeTruthy();
}

describe('DocumentUploadModal initialization', () => {
    beforeEach(() => {
        mocks.registry = undefined;
        mocks.process.mockReset().mockImplementation(async (selected) =>
            selected.map((file) => ({
                file,
                name: file.name,
                size: file.size,
                action: FileUploadAction.CREATE,
            })),
        );
    });

    it('keeps selected files when the type registry loads during analysis', async () => {
        let finish!: (value: FileWithMetadata[]) => void;
        mocks.process.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const view = render(modal());
        await chooseFiles();
        await waitFor(() => expect(mocks.process).toHaveBeenCalledOnce());
        mocks.registry = registry();
        view.rerender(modal());
        await act(async () =>
            finish(files.map((file) => ({ file, name: file.name, size: file.size, action: FileUploadAction.CREATE }))),
        );
        await expectAnalysis();
        expect(mocks.process).toHaveBeenCalledOnce();
    });

    it('preserves completed analysis across registry and session refreshes, then resets on reopen', async () => {
        mocks.registry = registry();
        const view = render(modal());
        await chooseFiles();
        await expectAnalysis();
        mocks.registry = registry();
        mocks.client = { ...mocks.client };
        mocks.toast = vi.fn();
        view.rerender(modal());
        await expectAnalysis();
        expect(mocks.process).toHaveBeenCalledOnce();
        view.rerender(modal(false));
        view.rerender(modal());
        await screen.findByLabelText('Select files');
        expect(screen.queryByText('2 files')).toBeNull();
    });

    it('resolves an initial type that arrives after opening without clearing files', async () => {
        const view = render(modal(true, type.id));
        await chooseFiles();
        await expectAnalysis();
        mocks.registry = registry();
        view.rerender(modal(true, type.id));
        await expectAnalysis();
        await screen.findByText('Invoice');
        expect(mocks.process).toHaveBeenCalledOnce();
    });
});
