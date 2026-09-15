import { type LazyExoticComponent, lazy } from 'react';

type ReactPdf = typeof import('react-pdf');

let reactPdfPromise: Promise<ReactPdf> | undefined;

/**
 * react-pdf carries pdf.js with it, which is by far the heaviest dependency of this package and is
 * only needed once a PDF is actually displayed. Loading it on demand keeps it out of the eager
 * bundle of every consuming app. The pdf.js worker (served from a CDN) is configured as part of the
 * same load, since it must be set before the first document is opened.
 */
function loadReactPdf(): Promise<ReactPdf> {
    if (!reactPdfPromise) {
        reactPdfPromise = import('react-pdf').then((reactPdf) => {
            const { pdfjs } = reactPdf;
            pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
