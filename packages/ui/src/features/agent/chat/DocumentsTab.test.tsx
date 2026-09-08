/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { DocumentsTab } from './DocumentsTab.js';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            store: {
                objects: {
                    getObjectText: vi.fn().mockResolvedValue({ text: 'Brief body' }),
                    retrieve: vi.fn().mockResolvedValue({ name: 'Brief' }),
                },
            },
        },
    }),
}));

vi.mock('@vertesia/ui/router', () => ({
    NavLink: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('@vertesia/ui/widgets', () => ({
    MarkdownRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

const documents = [
    { id: 'doc-1', title: 'Brief' },
    { id: 'doc-2', title: 'Summary' },
];

function renderDocumentsTab(props?: Partial<ComponentProps<typeof DocumentsTab>>) {
    const onSelectDocument = vi.fn();
    render(
        <I18nProvider lng="en">
            <DocumentsTab
                documents={documents}
                activeDocumentId={null}
                onSelectDocument={onSelectDocument}
                refreshKey={0}
                {...props}
            />
        </I18nProvider>,
    );
    return { onSelectDocument };
}

describe('DocumentsTab', () => {
    it('lists the open documents when none is selected', () => {
        renderDocumentsTab();

        expect(screen.getByText('2 documents')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Brief' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Summary' })).toBeTruthy();
    });

    it('links each list entry to its document page', () => {
        renderDocumentsTab();

        const links = screen.getAllByRole('link', { name: 'Open document' });
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/store/objects/doc-1#overview',
            '/store/objects/doc-2#overview',
        ]);
    });

    it('selects a document when its list entry is clicked', () => {
        const { onSelectDocument } = renderDocumentsTab();

        fireEvent.click(screen.getByRole('button', { name: 'Brief' }));

        expect(onSelectDocument).toHaveBeenCalledWith('doc-1');
    });

    it('goes back to the list from the selected document', () => {
        const { onSelectDocument } = renderDocumentsTab({ activeDocumentId: 'doc-1' });

        fireEvent.click(screen.getByRole('button', { name: 'Back to documents' }));

        expect(onSelectDocument).toHaveBeenCalledWith(null);
    });
});
