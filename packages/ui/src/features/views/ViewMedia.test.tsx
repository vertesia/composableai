import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import {
    ContentObjectStatus,
    type ExecuteViewRequest,
    type ViewDisplayConfiguration,
    type ViewExecutionDefinition,
    type ViewExecutionResult,
} from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import type { ViewMediaResolver } from './types.js';
import { DefaultViewResults } from './ViewResults.js';

const display: ViewDisplayConfiguration = {
    id: 'list',
    label: 'List',
    type: 'list',
    title: { field: 'name', label: 'Name' },
    media: { source: 'content_thumbnail' },
};

const definition: ViewExecutionDefinition = {
    name: 'Document Library',
    results: { default_display: 'list', displays: [display] },
};

const request: ExecuteViewRequest = { display: 'list' };

const result: ViewExecutionResult = {
    view: 'document-lib',
    revision: 1,
    definition,
    display: 'list',
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
                properties: {},
                revision: { root: 'document-1', head: true },
            },
        },
    ],
    total: 1,
    navigation: {},
    took: 1,
};

function renderResults(resolveMedia: ViewMediaResolver) {
    return renderWithProviders(
        <DefaultViewResults
            configuration={display}
            definition={definition}
            request={request}
            result={result}
            isLoading={false}
            resolveMedia={resolveMedia}
        />,
    );
}

// Property-backed media: the URL comes straight off the hit, so no resolver runs and no mediaKey
// exists. Rendered through the same DefaultViewResults path with a `thumbnail` property.
const propertyDisplay: ViewDisplayConfiguration = {
    ...display,
    media: { source: 'property', field: 'properties.thumbnail' },
};

const propertyDefinition: ViewExecutionDefinition = {
    name: 'Document Library',
    results: { default_display: 'list', displays: [propertyDisplay] },
};

function propertyResults(thumbnail: string) {
    const hit = result.hits[0];
    const propertyResult: ViewExecutionResult = {
        ...result,
        definition: propertyDefinition,
        hits: [{ ...hit, document: { ...hit.document, properties: { thumbnail } } }],
    };
    return (
        <DefaultViewResults
            configuration={propertyDisplay}
            definition={propertyDefinition}
            request={request}
            result={propertyResult}
            isLoading={false}
        />
    );
}

function renderPropertyResults(thumbnail: string) {
    const rendered = renderWithProviders(propertyResults(thumbnail));
    return {
        container: rendered.container,
        rerenderWith: (next: string) => rendered.rerender(propertyResults(next)),
    };
}

describe('ViewMedia resolution', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('keeps concurrent resolutions of the same media separate per resolver', async () => {
        const first = vi.fn<ViewMediaResolver>(async () => 'https://cdn.test/first.png');
        const second = vi.fn<ViewMediaResolver>(async () => 'https://cdn.test/second.png');

        const a = renderResults(first);
        const b = renderResults(second);

        await waitFor(() => {
            expect(a.container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/first.png');
            expect(b.container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/second.png');
        });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('retries a resolution that has no URL yet, then settles on the fallback', async () => {
        const resolveMedia = vi.fn<ViewMediaResolver>(async () => undefined);
        renderResults(resolveMedia);

        await waitFor(() => expect(resolveMedia).toHaveBeenCalledTimes(1));
        // Three backoff steps (2s, 4s, 8s), then the tile stops asking.
        for (const [delay, expected] of [
            [2_000, 2],
            [4_000, 3],
            [8_000, 4],
        ]) {
            await vi.advanceTimersByTimeAsync(delay);
            await waitFor(() => expect(resolveMedia).toHaveBeenCalledTimes(expected));
        }
        await vi.advanceTimersByTimeAsync(30_000);
        expect(resolveMedia).toHaveBeenCalledTimes(4);
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('does not retry a failed resolution', async () => {
        const resolveMedia = vi.fn<ViewMediaResolver>(async () => {
            throw new Error('Internal Server Error');
        });
        renderResults(resolveMedia);

        await waitFor(() => expect(resolveMedia).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(resolveMedia).toHaveBeenCalledTimes(1);
    });

    it('shows a refreshed direct URL after the previous one failed to load', async () => {
        const { container, rerenderWith } = renderPropertyResults('https://cdn.test/stale.png');

        const img = () => container.querySelector('img');
        expect(img()?.getAttribute('src')).toBe('https://cdn.test/stale.png');

        // The browser cannot fetch it — the tile falls back to the icon.
        fireEvent.error(img() as HTMLImageElement);
        await waitFor(() => expect(container.querySelector('img')).toBeNull());

        // A refreshed URL arrives on the same hit. No mediaKey exists for property media, so only
        // directUrl can tell the effect to clear the failure.
        rerenderWith('https://cdn.test/fresh.png');
        await waitFor(() =>
            expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/fresh.png'),
        );
    });
});
