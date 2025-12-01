import { useUserSession } from "@vertesia/ui/session";
import { VertesiaClient } from "@vertesia/client";
import {
    ContentObject,
    DocumentMetadata,
    GetFileUrlResponse,
    PDF_RENDITION_NAME,
    Rendition,
} from "@vertesia/common";
import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_COUNT = 10;
const ADVANCED_PROCESSING_PREFIX = "magic-pdf";

/**
 * Get the PDF source path from a ContentObject.
 * Returns the content source if it's a PDF, or the PDF rendition source if available.
 */
function getPdfSourcePath(object: ContentObject): string | null {
    // First, check if content type is PDF
    if (object.content?.type === 'application/pdf' && object.content?.source) {
        return object.content.source;
    }

    // Otherwise, check for a PDF rendition (e.g., from Office document conversion)
    const renditions = (object.metadata as DocumentMetadata)?.renditions as Rendition[] | undefined;
    const pdfRendition = renditions?.find(
        (r) => r.name === PDF_RENDITION_NAME && r.content?.type === 'application/pdf'
    );
    if (pdfRendition?.content?.source) {
        return pdfRendition.content.source;
    }

    return null;
}

/**
 * Lazy image URL provider that fetches URLs on demand and caches them.
 */
export class LazyImageUrlProvider {
    private cache: Map<number, string> = new Map();
    private pending: Map<number, Promise<string>> = new Map();

    constructor(
        private client: VertesiaClient,
        private objectId: string,
        private getPath: (objectId: string, pageNumber: number) => string
    ) {}

    async getUrl(pageNumber: number): Promise<string> {
        // Check cache first
        const cached = this.cache.get(pageNumber);
        if (cached) return cached;

        // Check if already fetching
        const pendingPromise = this.pending.get(pageNumber);
        if (pendingPromise) return pendingPromise;

        // Fetch the URL
        const promise = this.client.files
            .getDownloadUrl(this.getPath(this.objectId, pageNumber))
            .then((r) => {
                this.cache.set(pageNumber, r.url);
                this.pending.delete(pageNumber);
                return r.url;
            })
            .catch((e) => {
                this.pending.delete(pageNumber);
                throw e;
            });

        this.pending.set(pageNumber, promise);
        return promise;
    }

    // Preload a range of URLs (for visible pages)
    async preloadRange(start: number, end: number): Promise<void> {
        const promises: Promise<string>[] = [];
        for (let i = start; i <= end; i++) {
            if (!this.cache.has(i) && !this.pending.has(i)) {
                promises.push(this.getUrl(i).catch(() => '')); // Ignore errors during preload
            }
        }
        await Promise.all(promises);
    }
}

interface PdfPagesInfo {
    count: number;
    urls: string[];
    originalUrls: string[];
    annotatedUrls: string[];
    instrumentedUrls: string[];
    /** Lazy provider for annotated image URLs */
    annotatedImageProvider?: LazyImageUrlProvider;
    /** Lazy provider for original image URLs */
    originalImageProvider?: LazyImageUrlProvider;
    layoutProvider: PageLayoutProvider;
    markdownProvider: PageMarkdownProvider;
    xml: string;
    xmlPages: string[];
    pdfUrl: string;
    pdfUrlLoading: boolean;
    /** Whether this is an XML processor type (uses annotated images) */
    isXmlProcessor: boolean;
    /** Update the page count when actual count is determined from PDF */
    setActualPageCount?: (count: number) => void;
}

class PageLayoutProvider {
    layoutUrls: string[] = [];
    cache: string[];
    constructor(public totalPages: number) {
        this.cache = new Array<string>(totalPages);
    }
    async loadUrls(vertesia: VertesiaClient, objectId: string) {
        const layoutPromises: Promise<GetFileUrlResponse>[] = [];
        for (let i = 0; i < this.totalPages; i++) {
            layoutPromises.push(getLayoutUrlForPage(vertesia, objectId, i + 1));
        }
        const layoutUrls = await Promise.all(layoutPromises);
        this.layoutUrls = layoutUrls.map((r) => r.url);
    }
    async getPageLayout(page: number) {
        const index = page - 1;
        let content = this.cache[index];
        if (content === undefined) {
            const url = this.layoutUrls[index];
            content = await fetch(url, { method: "GET" }).then((r) => {
                if (r.ok) {
                    return r.text();
                } else {
                    throw new Error(
                        "Failed to fetch json layout: " + r.statusText,
                    );
                }
            });
            this.cache[index] = content;
        }
        return content;
    }
}

class PageMarkdownProvider {
    private pages: string[] = [];

    constructor(public totalPages: number) {}

    // Initialize by parsing pages from the full markdown content
    // Pages are delimited by <!-- {"page":N} --> markers
    initFromContent(markdownContent: string) {
        this.pages = extractMarkdownPages(markdownContent, this.totalPages);
    }

    // Keep for backwards compatibility with non-markdown processors
    async loadUrls(_vertesia: VertesiaClient, _objectId: string) {
        // No-op for markdown processor - content is already parsed
    }

    async getPageMarkdown(page: number): Promise<string> {
        const index = page - 1;
        if (index < 0 || index >= this.pages.length) {
            return '';
        }
        return this.pages[index];
    }
}

// Extract markdown pages from content delimited by <!-- {"page":N} --> markers
function extractMarkdownPages(content: string, totalPages: number): string[] {
    const pages: string[] = new Array(totalPages).fill('');

    // Match page delimiters: <!-- {"page":N} -->
    const pageDelimiterRegex = /<!--\s*\{\s*"page"\s*:\s*(\d+)\s*\}\s*-->/g;

    // Find all page markers and their positions
    const markers: { page: number; index: number }[] = [];
    let match;
    while ((match = pageDelimiterRegex.exec(content)) !== null) {
        markers.push({
            page: parseInt(match[1], 10),
            index: match.index + match[0].length,
        });
    }

    // Extract content between markers
    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        const pageIndex = marker.page - 1;

        if (pageIndex < 0 || pageIndex >= totalPages) {
            continue;
        }

        const startIndex = marker.index;

        // Find the actual end by looking for the next delimiter or end of content
        const nextDelimiterMatch = content.slice(startIndex).match(/<!--\s*\{\s*"page"\s*:\s*\d+\s*\}\s*-->/);
        const actualEndIndex = nextDelimiterMatch
            ? startIndex + nextDelimiterMatch.index!
            : content.length;

        let pageContent = content.slice(startIndex, actualEndIndex).trim();

        // Remove trailing --- separators if present
        pageContent = pageContent.replace(/\n---\s*$/, '').trim();

        pages[pageIndex] = pageContent;
    }

    return pages;
}

const PdfPageContext = createContext<PdfPagesInfo | undefined>(undefined);

interface PdfPageProviderProps {
    object: ContentObject;
    children: React.ReactNode;
}
export function PdfPageProvider({ children, object }: PdfPageProviderProps) {
    const { client } = useUserSession();
    const contentProcessorType = (object.metadata as DocumentMetadata)?.content_processor?.type;
    const isMarkdownProcessor = contentProcessorType === 'markdown';
    const isXmlProcessor = contentProcessorType === 'xml';
    const hasBeenProcessed = isMarkdownProcessor || isXmlProcessor;

    const [info, setInfo] = useState<PdfPagesInfo | undefined>(() => {
        const page_count = (object.metadata as DocumentMetadata).page_count || DEFAULT_PAGE_COUNT;
        const markdownProvider = new PageMarkdownProvider(page_count);

        // Parse pages directly from the content text for markdown processor
        if (object.text && isMarkdownProcessor) {
            markdownProvider.initFromContent(object.text);
        }

        const xml = object.text ? cleanXml(object.text) : "";

        // Create initial info for all processor types
        // This allows the UI to render immediately while async data loads
        return {
            count: page_count,
            urls: [],
            originalUrls: [],
            annotatedUrls: [],
            instrumentedUrls: [],
            annotatedImageProvider: isXmlProcessor
                ? new LazyImageUrlProvider(client, object.id, getPageAnnotatedImagePath)
                : undefined,
            originalImageProvider: isXmlProcessor
                ? new LazyImageUrlProvider(client, object.id, getPageOriginalImagePath)
                : undefined,
            layoutProvider: new PageLayoutProvider(page_count),
            markdownProvider,
            xml,
            xmlPages: object.text ? extractXmlPages(xml) : [],
            pdfUrl: '',
            pdfUrlLoading: true,
            isXmlProcessor,
        };
    });

    // Callback to update page count when actual count is determined from PDF
    const setActualPageCount = useCallback((actualCount: number) => {
        setInfo(prev => {
            if (!prev || prev.count === actualCount) return prev;
            return { ...prev, count: actualCount };
        });
    }, []);

    useEffect(() => {
        const page_count = (object.metadata as DocumentMetadata).page_count || DEFAULT_PAGE_COUNT;

        if (isMarkdownProcessor || !hasBeenProcessed) {
            // For markdown processor or unprocessed documents, only fetch the PDF URL
            // Use getPdfSourcePath to support both native PDFs and PDF renditions (from Office conversions)
            const pdfSource = getPdfSourcePath(object);
            if (pdfSource) {
                client.store.objects.getDownloadUrl(pdfSource, undefined, 'inline')
                    .then((response) => {
                        setInfo(prev => prev ? { ...prev, pdfUrl: response.url, pdfUrlLoading: false } : prev);
                    })
                    .catch((e) => {
                        console.warn('Failed to get PDF URL:', e);
                        setInfo(prev => prev ? { ...prev, pdfUrlLoading: false } : prev);
                    });
            } else {
                setInfo(prev => prev ? { ...prev, pdfUrlLoading: false } : prev);
            }
        } else if (isXmlProcessor) {
            // For XML processors, use the full async loading with page images
            getPdfPagesInfo(client, object, page_count).then(setInfo);
        }
    }, [object.id, client, isMarkdownProcessor, isXmlProcessor, hasBeenProcessed]);

    // Memoize context value to include setActualPageCount
    const contextValue = useMemo(() => {
        if (!info) return undefined;
        return { ...info, setActualPageCount };
    }, [info, setActualPageCount]);

    return (
        contextValue && (
            <PdfPageContext.Provider value={contextValue}>
                {children}
            </PdfPageContext.Provider>
        )
    );
}

function getBasePath(objectId: string) {
    return `${ADVANCED_PROCESSING_PREFIX}/${objectId}`;
}

function getPageAnnotatedImagePath(
    objectId: string,
    pageNumber: number,
    ext = ".jpg",
) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}-annotated${ext}`;
}

function getPageOriginalImagePath(
    objectId: string,
    pageNumber: number,
    ext = ".jpg",
) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}.original${ext}`;
}

function getLayoutJsonPath(objectId: string, pageNumber: number) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}.layout.json`;
}


export function getResourceUrl(
    vertesia: VertesiaClient,
    objectId: string,
    name: string,
): Promise<string> {
    return vertesia.files
        .getDownloadUrl(`${getBasePath(objectId)}/${name}`)
        .then((r) => r.url);
}

function getLayoutUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getLayoutJsonPath(objectId, pageNumber),
    );
}

async function getPdfPagesInfo(
    vertesia: VertesiaClient,
    object: ContentObject,
    page_count: number,
): Promise<PdfPagesInfo> {
    // Get the PDF URL from content source or PDF rendition
    let pdfUrl = '';
    const pdfSource = getPdfSourcePath(object);
    if (pdfSource) {
        try {
            const pdfUrlResponse = await vertesia.store.objects.getDownloadUrl(
                pdfSource,
                undefined,
                'inline'
            );
            pdfUrl = pdfUrlResponse.url;
        } catch (e) {
            console.warn('Failed to get PDF URL:', e);
        }
    }

    // Create lazy providers for image URLs - they will be fetched on demand
    const annotatedImageProvider = new LazyImageUrlProvider(
        vertesia,
        object.id,
        getPageAnnotatedImagePath
    );
    const originalImageProvider = new LazyImageUrlProvider(
        vertesia,
        object.id,
        getPageOriginalImagePath
    );

    const layoutProvider = new PageLayoutProvider(page_count);
    // Don't load all layout URLs upfront - they will be loaded on demand

    const markdownProvider = new PageMarkdownProvider(page_count);

    const xml = object.text ? cleanXml(object.text) : "";

    return {
        count: page_count,
        urls: [], // Deprecated - use lazy providers instead
        originalUrls: [], // Deprecated - use lazy providers instead
        annotatedUrls: [], // Deprecated - use lazy providers instead
        instrumentedUrls: [], // Deprecated - use lazy providers instead
        annotatedImageProvider,
        originalImageProvider,
        layoutProvider,
        markdownProvider,
        xml,
        xmlPages: object.text ? extractXmlPages(xml) : [],
        pdfUrl,
        pdfUrlLoading: false,
        isXmlProcessor: true,
    };
}

export function usePdfPagesInfo() {
    const context = React.useContext(PdfPageContext);
    if (!context) {
        throw new Error(
            "usePdfPagesInfo must be used within a PdfPageProvider",
        );
    }
    return context;
}

function extractXmlPages(xml: string): string[] {
    // Parse the XML string
    const doc = new DOMParser().parseFromString(cleanXml(xml), "text/xml");
    const pages = doc.getElementsByTagName("page");
    const serializer = new XMLSerializer();
    return Array.from(pages).map((p) => serializer.serializeToString(p));
}

function cleanXml(xml: string) {
    const cleanedXML = xml
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .replace(/<\?xml.*?\?>/g, "");
    return cleanedXML;
}
