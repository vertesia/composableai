import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownLink } from './MarkdownLink.js';

vi.mock('./useResolvedUrl.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./useResolvedUrl.js')>();
    return {
        ...actual,
        useResolvedUrl: () => ({
            url: 'https://example.test/artifact',
            isLoading: false,
            error: undefined,
            scheme: 'artifact' as const,
            retry: vi.fn(),
        }),
    };
});

describe('MarkdownLink artifact navigation', () => {
    afterEach(cleanup);

    it('opens a Markdown artifact in the host viewer', () => {
        const onArtifactOpen = vi.fn();
        render(
            <MarkdownLink href="artifact:files/report.md" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report
            </MarkdownLink>,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Report' }));

        expect(onArtifactOpen).toHaveBeenCalledWith('files/report.md');
    });

    it('keeps modified clicks and non-Markdown artifacts as downloads', () => {
        const onArtifactOpen = vi.fn();
        const view = render(
            <MarkdownLink href="artifact:files/report.md" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report
            </MarkdownLink>,
        );

        fireEvent.click(screen.getByRole('link', { name: 'Report' }), { metaKey: true });
        expect(onArtifactOpen).not.toHaveBeenCalled();

        view.rerender(
            <MarkdownLink href="artifact:files/report.pdf" artifactRunId="run-1" onArtifactOpen={onArtifactOpen}>
                Report PDF
            </MarkdownLink>,
        );
        fireEvent.click(screen.getByRole('link', { name: 'Report PDF' }));

        expect(onArtifactOpen).not.toHaveBeenCalled();
    });
});
