import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { ContentObjectStatus, type ViewExecutionResult } from '@vertesia/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { ViewExperience } from './ViewExperience.js';

const result: ViewExecutionResult = {
    view: 'document-lib',
    revision: 2,
    definition: {
        name: 'Document Library',
        layout: { mode: 'browse', navigation_position: 'sidebar' },
        search: { mode: 'deterministic', placeholder: 'Find documents' },
        navigation: [
            {
                id: 'brand',
                label: 'Brand',
                source: 'terms',
                field: 'properties.brand',
                presentation: 'list',
            },
        ],
        results: {
            default_display: 'table',
            displays: [
                {
                    id: 'table',
                    label: 'Table',
                    type: 'table',
                    columns: [
                        { field: 'name', label: 'Name' },
                        { field: 'properties.brand', label: 'Brand' },
                    ],
                },
            ],
        },
    },
    display: 'table',
    search: { requested_mode: 'browse', applied_mode: 'browse', warnings: [] },
    hits: [
        {
            id: 'document-1',
            document: {
                id: 'document-1',
                name: 'Renewal Agreement',
                created_at: '2026-01-01T00:00:00.000Z',
                created_by: 'user-1',
                updated_at: '2026-01-02T00:00:00.000Z',
                updated_by: 'user-1',
                location: '/Customers/Acme',
                status: ContentObjectStatus.completed,
                properties: { brand: 'Acme' },
                revision: { root: 'document-1', head: true },
            },
        },
    ],
    total: 1,
    navigation: {
        brand: {
            id: 'brand',
            selected: [],
            nodes: [{ id: 'Acme', label: 'Acme', count: 1 }],
        },
    },
    took: 5,
};

describe('ViewExperience', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders configured search, navigation, and table results and executes selected facets', async () => {
        const execute = vi.fn().mockResolvedValue(result);
        renderWithProviders(
            <ViewExperience viewId="document-lib" execute={execute} syncUrl={false} showHeader={false} />,
        );

        expect(await screen.findByText('Renewal Agreement')).not.toBeNull();
        expect(screen.getByPlaceholderText('Find documents')).not.toBeNull();
        expect(screen.getAllByText('Brand').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Acme').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('checkbox', { name: /Acme/ }));

        await waitFor(() => {
            expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ navigation: { brand: ['Acme'] } }));
        });
    });

    it('uses an app-provided resolver for content thumbnails', async () => {
        const execute = vi.fn().mockResolvedValue({
            ...result,
            definition: {
                name: 'Visual assets',
                results: {
                    default_display: 'gallery',
                    displays: [
                        {
                            id: 'gallery',
                            label: 'Gallery',
                            type: 'gallery',
                            title: { field: 'name' },
                            media: { source: 'content_thumbnail', fallback: 'type_icon' },
                        },
                    ],
                },
            },
            display: 'gallery',
        } satisfies ViewExecutionResult);
        const resolveMedia = vi.fn().mockResolvedValue('https://example.com/thumbnail.jpg');

        renderWithProviders(
            <ViewExperience
                viewId="visual-assets"
                execute={execute}
                resolveMedia={resolveMedia}
                syncUrl={false}
                showHeader={false}
            />,
        );

        await waitFor(() => {
            expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/thumbnail.jpg');
        });
        expect(resolveMedia).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'document-1' }),
            expect.objectContaining({ source: 'content_thumbnail' }),
        );
    });

    it('resolves content thumbnails in list displays', async () => {
        const execute = vi.fn().mockResolvedValue({
            ...result,
            definition: {
                name: 'Visual assets',
                results: {
                    default_display: 'list',
                    displays: [
                        {
                            id: 'list',
                            label: 'List',
                            type: 'list',
                            title: { field: 'name' },
                            media: { source: 'content_thumbnail', fallback: 'type_icon' },
                        },
                    ],
                },
            },
            display: 'list',
        } satisfies ViewExecutionResult);
        const resolveMedia = vi.fn().mockResolvedValue('https://example.com/list-thumbnail.jpg');

        renderWithProviders(
            <ViewExperience
                viewId="visual-list"
                execute={execute}
                resolveMedia={resolveMedia}
                syncUrl={false}
                showHeader={false}
            />,
        );

        await waitFor(() => {
            expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/list-thumbnail.jpg');
        });
    });

    it('honors configured media fallbacks', async () => {
        const execute = vi.fn().mockResolvedValue({
            ...result,
            definition: {
                name: 'Visual assets',
                results: {
                    default_display: 'cards',
                    displays: [
                        {
                            id: 'cards',
                            label: 'Cards',
                            type: 'cards',
                            title: { field: 'name' },
                            media: { source: 'content_thumbnail', fallback: 'placeholder' },
                        },
                    ],
                },
            },
            display: 'cards',
        } satisfies ViewExecutionResult);
        const resolveMedia = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <ViewExperience
                viewId="visual-fallback"
                execute={execute}
                resolveMedia={resolveMedia}
                syncUrl={false}
                showHeader={false}
            />,
        );

        await waitFor(() => expect(resolveMedia).toHaveBeenCalled());
        expect(document.querySelector('svg.lucide-image')).not.toBeNull();
        expect(document.querySelector('svg.lucide-file-text')).toBeNull();
    });

    it('executes the sort option configured on a table column', async () => {
        const sortableResult = {
            ...result,
            sort: 'name_asc',
            definition: {
                ...result.definition,
                results: {
                    default_display: 'table',
                    default_sort: 'name_asc',
                    displays: [
                        {
                            id: 'table',
                            label: 'Table',
                            type: 'table',
                            columns: [
                                {
                                    field: 'name',
                                    label: 'Name',
                                    sortable: true,
                                    sort_option: 'name_asc',
                                },
                            ],
                        },
                    ],
                    sort_options: [
                        {
                            id: 'name_asc',
                            label: 'Name',
                            sort: [{ field: 'name.keyword', order: 'asc' }],
                        },
                    ],
                },
            },
        } satisfies ViewExecutionResult;
        const execute = vi.fn().mockResolvedValue(sortableResult);

        renderWithProviders(<ViewExperience viewId="sortable" execute={execute} syncUrl={false} showHeader={false} />);

        const sortButton = await screen.findByRole('button', { name: 'Name' });
        expect(sortButton.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
        fireEvent.click(sortButton);

        await waitFor(() => {
            expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name_asc' }));
        });
    });
});
