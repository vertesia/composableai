import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { SelectDocument } from './SelectDocument';

const mocks = vi.hoisted(() => ({
    documentTableProps: vi.fn(),
    searchObjects: vi.fn(),
    computeFacets: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        store: {
            collections: {
                computeFacets: mocks.computeFacets,
                searchMembers: mocks.searchObjects,
            },
            objects: {
                computeFacets: mocks.computeFacets,
                search: mocks.searchObjects,
            },
        },
    }),
}));

vi.mock('../../../facets', () => ({
    DocumentsFacetsNav: () => <div data-testid="document-facets" />,
}));

vi.mock('../DocumentTable', () => ({
    DocumentTable: (props: { isLoading: boolean; objects: unknown[] }) => {
        mocks.documentTableProps(props);
        return (
            <div
                data-testid="document-table"
                data-loading={String(props.isLoading)}
                data-object-count={props.objects.length}
            />
        );
    },
}));

vi.mock('./ContentDispositionButton', () => ({
    ContentDispositionButton: () => <button type="button">Toggle view</button>,
}));

class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

function renderSelectDocument() {
    return render(
        <I18nProvider lng="en">
            <SelectDocument onChange={vi.fn()} />
        </I18nProvider>,
    );
}

describe('SelectDocument', () => {
    beforeEach(() => {
        vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('uses the document table loading state for the initial search', async () => {
        mocks.searchObjects.mockReturnValue(new Promise(() => undefined));

        renderSelectDocument();

        await waitFor(() => {
            expect(screen.getByTestId('document-table').getAttribute('data-loading')).toBe('true');
        });
        expect(mocks.documentTableProps).toHaveBeenLastCalledWith(
            expect.objectContaining({
                isLoading: true,
                objects: [],
            }),
        );
    });
});
