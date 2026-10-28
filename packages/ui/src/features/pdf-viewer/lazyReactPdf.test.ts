import { afterEach, describe, expect, it, vi } from 'vitest';

// Each case imports the module fresh: lazyReactPdf keeps the worker location and the loaded module in
// module scope, which is the behavior under test.
afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react-pdf');
});

function mockReactPdf(): { GlobalWorkerOptions: { workerSrc?: string } } {
    const GlobalWorkerOptions: { workerSrc?: string } = {};
    vi.doMock('react-pdf', () => ({
        pdfjs: { version: '6.3.289', GlobalWorkerOptions },
        Document: () => null,
        Page: () => null,
    }));
    return { GlobalWorkerOptions };
}

describe('loadReactPdf', () => {
    it('loads the worker of the same pdf.js version from the public CDN by default', async () => {
        const { GlobalWorkerOptions } = mockReactPdf();
        const { loadReactPdf } = await import('./lazyReactPdf.js');

        await loadReactPdf();

        expect(GlobalWorkerOptions.workerSrc).toBe('//unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs');
    });

    it('loads the worker from the location the app set, for the pdf.js version it carries', async () => {
        const { GlobalWorkerOptions } = mockReactPdf();
        const { loadReactPdf, setPdfWorkerUrl } = await import('./lazyReactPdf.js');

        setPdfWorkerUrl((version) => `/cdn/pdfjs-dist-${version}/pdf.worker.min.mjs`);
        await loadReactPdf();

        expect(GlobalWorkerOptions.workerSrc).toBe('/cdn/pdfjs-dist-6.3.289/pdf.worker.min.mjs');
    });
});
