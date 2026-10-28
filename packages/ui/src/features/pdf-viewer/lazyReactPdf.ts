import { type LazyExoticComponent, lazy } from 'react';

type ReactPdf = typeof import('react-pdf');

/** Builds the URL of the pdf.js worker from the version of the pdf.js API that react-pdf carries. */
export type PdfWorkerUrlResolver = (pdfjsVersion: string) => string;

const unpkgWorkerUrl: PdfWorkerUrlResolver = (version) => `//unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

let resolvePdfWorkerUrl: PdfWorkerUrlResolver = unpkgWorkerUrl;

let reactPdfPromise: Promise<ReactPdf> | undefined;

/**
 * Load the pdf.js worker from the URL `resolve` returns instead of the public CDN: for example a copy
 * the app serves from its own origin, so its Content Security Policy does not have to allow a
 * third-party script host. A worker on another origin is started by pdf.js through a `blob:` wrapper
 * that imports it, which needs that origin in `script-src`, not only in `worker-src`.
 *
 * `resolve` receives the pdf.js version, because pdf.js refuses a worker whose version differs from
 * its API. Call it at startup, before the first PDF opens: the worker location is read then.
 */
export function setPdfWorkerUrl(resolve: PdfWorkerUrlResolver): void {
    resolvePdfWorkerUrl = resolve;
}

/**
 * react-pdf carries pdf.js with it, which is by far the heaviest dependency of this package and is
 * only needed once a PDF is actually displayed. Loading it on demand keeps it out of the eager
 * bundle of every consuming app. The pdf.js worker is configured as part of the same load, since it
 * must be set before the first document is opened.
 */
export function loadReactPdf(): Promise<ReactPdf> {
    if (!reactPdfPromise) {
        reactPdfPromise = import('react-pdf').then((reactPdf) => {
            const { pdfjs } = reactPdf;
            pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerUrl(pdfjs.version);
            return reactPdf;
        });
    }
    return reactPdfPromise;
}

/**
 * Drop-in replacements for react-pdf's `Document` and `Page`. Both resolve from the same load, so a
 * single `Suspense` boundary around the `Document` also covers the `Page` elements inside it.
 */
export const Document: LazyExoticComponent<ReactPdf['Document']> = lazy(() =>
    loadReactPdf().then(({ Document: component }) => ({ default: component })),
);
export const Page: LazyExoticComponent<ReactPdf['Page']> = lazy(() =>
    loadReactPdf().then(({ Page: component }) => ({ default: component })),
);
