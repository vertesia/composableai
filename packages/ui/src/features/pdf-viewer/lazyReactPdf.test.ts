// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Each case imports the module fresh: lazyReactPdf keeps the worker location and the loaded module in
// module scope, which is the behavior under test.
afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.doUnmock('react-pdf');
});

interface DocumentProps {
    file?: string;
    options?: { wasmUrl?: string };
}

function mockReactPdf(): {
    GlobalWorkerOptions: { workerSrc?: string };
    documentProps: DocumentProps[];
} {
    const GlobalWorkerOptions: { workerSrc?: string } = {};
    const documentProps: DocumentProps[] = [];
    vi.doMock('react-pdf', () => ({
        pdfjs: { version: '6.3.289', GlobalWorkerOptions },
        Document: (props: DocumentProps) => {
            documentProps.push(props);
            return createElement('div', { 'data-testid': 'document' });
        },
        Page: () => null,
    }));
    return { GlobalWorkerOptions, documentProps };
}

async function renderDocument(props: DocumentProps): Promise<void> {
    const { Document } = await import('./lazyReactPdf.js');
    const view = render(createElement(Suspense, { fallback: null }, createElement(Document, props)));
    await within(view.container).findByTestId('document');
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

describe('Document', () => {
    it('gives pdf.js the decoders of the same version from the public CDN by default', async () => {
        const { documentProps } = mockReactPdf();

        await renderDocument({ file: 'a.pdf' });

        expect(documentProps.at(-1)?.options).toEqual({ wasmUrl: '//unpkg.com/pdfjs-dist@6.3.289/wasm/' });
    });

    it('gives pdf.js the decoders from the location the app set', async () => {
        const { documentProps } = mockReactPdf();
        const { setPdfWasmUrl } = await import('./lazyReactPdf.js');

        setPdfWasmUrl((version) => `/cdn/pdfjs-dist-${version}/wasm/`);
        await renderDocument({ file: 'a.pdf' });

        expect(documentProps.at(-1)?.file).toBe('a.pdf');
        expect(documentProps.at(-1)?.options).toEqual({ wasmUrl: '/cdn/pdfjs-dist-6.3.289/wasm/' });
    });

    it('opens every document with the same options object, so react-pdf does not reload it', async () => {
        const { documentProps } = mockReactPdf();

        await renderDocument({ file: 'a.pdf' });
        await renderDocument({ file: 'b.pdf' });

        expect(documentProps.at(-1)?.options).toBe(documentProps[0]?.options);
    });

    it('keeps the options a caller passes', async () => {
        const { documentProps } = mockReactPdf();
        const options = { wasmUrl: '/elsewhere/' };

        await renderDocument({ file: 'a.pdf', options });

        expect(documentProps.at(-1)?.options).toBe(options);
    });
});
