import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { GroundedExtractionPanel } from './GroundedExtractionView.js';

const { mockClient } = vi.hoisted(() => {
    const downloadUrl = vi.fn((path: string) => Promise.resolve({ url: `https://files.test/${path}` }));
    return {
        mockClient: { files: { getDownloadUrl: downloadUrl } },
    };
});

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: mockClient,
    }),
}));

describe('GroundedExtractionPanel', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('switches between the original and checkerboard page and shows the selected A1 range', async () => {
        const extraction = {
            version: 1,
            object_id: 'object-1',
            run_id: 'run-1',
            generated_at: '2026-07-13T16:30:27.418Z',
            pages: { '1': { width: 612, height: 792 } },
            data: { part_number: 'DFVS25' },
            citations: [
                {
                    path: 'part_number',
                    page: 1,
                    block_ids: [],
                    cells: { start: 'E38', end: 'J38' },
                    verified: false,
                    reviewed: true,
                    value: 'DFVS25',
                    boxes: [{ x: 59.7, y: 552.9, w: 89.6, h: 17.4 }],
                    confidence: 0.99,
                },
            ],
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify(extraction), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        renderWithProviders(<GroundedExtractionPanel objectId="object-1" />);

        const pageImage = await screen.findByAltText('Page 1');
        expect(pageImage.getAttribute('src')).toContain('page-1.original.jpg');

        fireEvent.click(screen.getByRole('button', { name: 'Checkerboard' }));
        await waitFor(() => expect(screen.getByAltText('Page 1').getAttribute('src')).toContain('page-1.grid.jpg'));

        fireEvent.click(screen.getByText('DFVS25'));
        expect(screen.getByText('E38:J38')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'part_number' }).getAttribute('title')).toContain('E38:J38');
    });
});
