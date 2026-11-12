import { createElement, forwardRef, type LazyExoticComponent, lazy } from 'react';

type ReactPdf = typeof import('react-pdf');
type DocumentComponent = ReactPdf['Document'];
type DocumentOptions = NonNullable<React.ComponentProps<DocumentComponent>['options']>;

/** Builds the URL of the pdf.js worker from the version of the pdf.js API that react-pdf carries. */
export type PdfWorkerUrlResolver = (pdfjsVersion: string) => string;

/**
 * Builds the URL of the directory holding pdf.js's WebAssembly decoders (`openjpeg.wasm` for JPEG 2000
 * images, `jbig2.wasm`, `qcms_bg.wasm` and their JavaScript fallbacks), with a trailing slash.
 */
export type PdfWasmUrlResolver = (pdfjsVersion: string) => string;

const unpkgWorkerUrl: PdfWorkerUrlResolver = (version) => `//unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
const unpkgWasmUrl: PdfWasmUrlResolver = (version) => `//unpkg.com/pdfjs-dist@${version}/wasm/`;

let resolvePdfWorkerUrl: PdfWorkerUrlResolver = unpkgWorkerUrl;
let resolvePdfWasmUrl: PdfWasmUrlResolver = unpkgWasmUrl;

let reactPdfPromise: Promise<ReactPdf> | undefined;

/**
 * The options every document opens with. One object for the page's lifetime: react-pdf reloads a
 * document whenever its `options` prop changes identity.
 */
let documentOptions: DocumentOptions | undefined;

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
 * Load pdf.js's WebAssembly decoders from the directory `resolve` returns instead of the public CDN.
 * pdf.js needs them to draw JPEG 2000 and JBIG2 images and to apply ICC color profiles; without them
 * those images are left blank. The worker fetches the `.wasm` files and imports the fallback modules
 * from that directory, so serve it next to the worker. Call it at startup, like {@link setPdfWorkerUrl}.
 */
export function setPdfWasmUrl(resolve: PdfWasmUrlResolver): void {
    resolvePdfWasmUrl = resolve;
}

/**
 * react-pdf carries pdf.js with it, which is by far the heaviest dependency of this package and is
 * only needed once a PDF is actually displayed. Loading it on demand keeps it out of the eager
 * bundle of every consuming app. The pdf.js worker and decoder locations are configured as part of
 * the same load, since they must be set before the first document is opened.
 */
export function loadReactPdf(): Promise<ReactPdf> {
    if (!reactPdfPromise) {
        reactPdfPromise = import('react-pdf').then((reactPdf) => {
            const { pdfjs } = reactPdf;
            pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerUrl(pdfjs.version);
            documentOptions = { wasmUrl: resolvePdfWasmUrl(pdfjs.version) };
            return reactPdf;
        });
    }
    return reactPdfPromise;
}

/** react-pdf's `Document`, opening each file with {@link documentOptions} unless the caller passes its own. */
function withDocumentOptions(component: DocumentComponent): DocumentComponent {
    const DocumentWithOptions = forwardRef<
        React.ComponentRef<DocumentComponent>,
        React.ComponentPropsWithoutRef<DocumentComponent>
    >(function DocumentWithOptions(props, ref) {
        return createElement(component, { ...props, ref, options: props.options ?? documentOptions });
    });
    return DocumentWithOptions as DocumentComponent;
}

/**
 * Drop-in replacements for react-pdf's `Document` and `Page`. Both resolve from the same load, so a
 * single `Suspense` boundary around the `Document` also covers the `Page` elements inside it.
 */
export const Document: LazyExoticComponent<DocumentComponent> = lazy(() =>
    loadReactPdf().then(({ Document: component }) => ({ default: withDocumentOptions(component) })),
);
export const Page: LazyExoticComponent<ReactPdf['Page']> = lazy(() =>
    loadReactPdf().then(({ Page: component }) => ({ default: component })),
);
