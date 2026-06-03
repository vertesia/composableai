import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';

const { getArtifactDownloadUrl, getDownloadUrl } = vi.hoisted(() => ({
    getArtifactDownloadUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
}));

vi.mock('../pdf-viewer/SimplePdfViewer.js', () => ({
    SimplePdfViewer: () => <div data-testid="pdf-viewer" />,
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            files: {
                getArtifactDownloadUrl,
                getDownloadUrl,
            },
        },
    }),
}));

import { UniversalDocumentViewer } from './UniversalDocumentViewer';

describe('UniversalDocumentViewer TSX sandbox preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getArtifactDownloadUrl.mockImplementation(
            async (_runId: string, path: string, _disposition: 'inline' | 'attachment') => ({
                url: `https://signed.example/${encodeURIComponent(path)}`,
            }),
        );
        getDownloadUrl.mockImplementation(
            async (path: string, _fileName?: string, _disposition?: 'inline' | 'attachment') => ({
                url: `https://signed.example/${encodeURIComponent(path)}`,
            }),
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                const decodedUrl = decodeURIComponent(url);
                const body = decodedUrl.endsWith('.render.json')
                    ? JSON.stringify({
                          ok: true,
                          source_artifact: 'files/mockups/Dashboard.tsx',
                          screenshot_artifact: 'files/mockups/Dashboard.png',
                          rendered_at: '2026-06-03T12:00:00.000Z',
                          viewport: { width: 1440, height: 900 },
                          dependencies_reused: true,
                          status: 200,
                          timings_ms: { total_before_cleanup: 11481 },
                      })
                    : 'export default function Dashboard() { return <main>Dashboard</main>; }';
                return {
                    ok: true,
                    statusText: 'OK',
                    text: async () => body,
                };
            }),
        );
    });

    it('renders a sibling sandbox PNG preview for TSX artifacts without executing source in Studio', async () => {
        renderWithProviders(
            <UniversalDocumentViewer
                source={{
                    fileName: 'Dashboard.tsx',
                    contentType: 'text/typescript',
                    artifact: {
                        runId: 'agent-run-1',
                        path: 'files/mockups/Dashboard.tsx',
                    },
                }}
            />,
        );

        await screen.findByText('PNG preview');
        const image = screen.getByAltText('Dashboard.tsx sandbox render') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe('https://signed.example/files%2Fmockups%2FDashboard.png');
        expect(screen.getByText('deps reused')).toBeTruthy();
        expect(screen.getByText('Total 11 s')).toBeTruthy();
        expect(screen.getByText(/export default function Dashboard/)).toBeTruthy();

        await waitFor(() => {
            expect(getArtifactDownloadUrl).toHaveBeenCalledWith(
                'agent-run-1',
                'files/mockups/Dashboard.render.json',
                'inline',
            );
        });
        expect(getArtifactDownloadUrl).toHaveBeenCalledWith('agent-run-1', 'files/mockups/Dashboard.png', 'inline');
    });

    it('resolves copied render metadata relative to app design storage paths', async () => {
        renderWithProviders(
            <UniversalDocumentViewer
                source={{
                    fileName: 'Dashboard.tsx',
                    contentType: 'text/typescript',
                    sourcePath: 'apps/store-health/designs/design-1/artifacts/files/mockups/Dashboard.tsx',
                }}
            />,
        );

        await screen.findByText('PNG preview');
        const image = screen.getByAltText('Dashboard.tsx sandbox render') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe(
            'https://signed.example/apps%2Fstore-health%2Fdesigns%2Fdesign-1%2Fartifacts%2Ffiles%2Fmockups%2FDashboard.png',
        );
        expect(getDownloadUrl).toHaveBeenCalledWith(
            'apps/store-health/designs/design-1/artifacts/files/mockups/Dashboard.render.json',
            'Dashboard.render.json',
            'inline',
        );
        expect(getDownloadUrl).toHaveBeenCalledWith(
            'apps/store-health/designs/design-1/artifacts/files/mockups/Dashboard.png',
            'Dashboard.png',
            'inline',
        );
    });
});
