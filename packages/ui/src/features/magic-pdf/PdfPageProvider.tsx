import { useUserSession } from "@vertesia/ui/session";
import { VertesiaClient } from "@vertesia/client";
import {
    ContentObject,
    DocumentMetadata,
    GetFileUrlResponse,
} from "@vertesia/common";
import React, { createContext, useEffect, useState } from "react";

const DEFAULT_PAGE_COUNT = 10;
const ADVANCED_PROCESSING_PREFIX = "magic-pdf";

interface PdfPagesInfo {
    count: number;
    urls: string[];
    originalUrls: string[];
    annotatedUrls: string[];
    instrumentedUrls: string[];
    layoutProvider: PageLayoutProvider;
    markdownProvider: PageMarkdownProvider;
    xml: string;
    xmlPages: string[];
    pdfUrl: string;
    pdfUrlLoading: boolean;
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
    const [info, setInfo] = useState<PdfPagesInfo | undefined>(() => {
        // For markdown processor, create initial info immediately (synchronously)
        const isMarkdownProcessor = (object.metadata as DocumentMetadata)?.content_processor?.type === 'markdown';
        if (isMarkdownProcessor) {
            const page_count = (object.metadata as DocumentMetadata).page_count || DEFAULT_PAGE_COUNT;
            const markdownProvider = new PageMarkdownProvider(page_count);
            // Parse pages directly from the content text instead of fetching individual files
            if (object.text) {
                markdownProvider.initFromContent(object.text);
            }
            const xml = object.text ? cleanXml(object.text) : "";
            return {
                count: page_count,
                urls: [],
                originalUrls: [],
                annotatedUrls: [],
                instrumentedUrls: [],
                layoutProvider: new PageLayoutProvider(page_count),
                markdownProvider,
                xml,
                xmlPages: object.text ? extractXmlPages(xml) : [],
                pdfUrl: '',
                pdfUrlLoading: true,
            };
        }
        return undefined;
    });

    useEffect(() => {
        const isMarkdownProcessor = (object.metadata as DocumentMetadata)?.content_processor?.type === 'markdown';
        const page_count = (object.metadata as DocumentMetadata).page_count || DEFAULT_PAGE_COUNT;

        if (isMarkdownProcessor) {
            // For markdown processor, only fetch the PDF URL lazily
            if (object.content?.source) {
                client.store.objects.getDownloadUrl(object.content.source, undefined, 'inline')
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
        } else {
            // For non-markdown processors, use the original async loading
            getPdfPagesInfo(client, object, page_count).then(setInfo);
        }
    }, [object.id, client]);

    return (
        info && (
            <PdfPageContext.Provider value={info}>
                {children}
            </PdfPageContext.Provider>
        )
    );
}

function getBasePath(objectId: string) {
    return `${ADVANCED_PROCESSING_PREFIX}/${objectId}`;
}

function getPageImagePath(objectId: string, pageNumber: number, ext = ".jpg") {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}${ext}`;
}

function getPageAnnotatedImagePath(
    objectId: string,
    pageNumber: number,
    ext = ".jpg",
) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}-annotated${ext}`;
}

function getPageInstrumentedImagePath(
    objectId: string,
    pageNumber: number,
    ext = ".jpg",
) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}.instrumented${ext}`;
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

function getImageUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getPageImagePath(objectId, pageNumber),
    );
}

function getAnnotatedImageUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getPageAnnotatedImagePath(objectId, pageNumber),
    );
}

function getInstrumentedImageUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getPageInstrumentedImagePath(objectId, pageNumber),
    );
}

function getOriginalImageUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getPageOriginalImagePath(objectId, pageNumber),
    );
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
    // Get the original PDF URL from content source
    let pdfUrl = '';
    if (object.content?.source) {
        try {
            const pdfUrlResponse = await vertesia.store.objects.getDownloadUrl(
                object.content.source,
                undefined,
                'inline'
            );
            pdfUrl = pdfUrlResponse.url;
        } catch (e) {
            console.warn('Failed to get PDF URL:', e);
        }
    }

    // For non-markdown processors, fetch all image URLs
    const imageUrlPromises: Promise<GetFileUrlResponse>[] = [];
    for (let i = 0; i < page_count; i++) {
        imageUrlPromises.push(getImageUrlForPage(vertesia, object.id, i + 1));
    }
    const imageUrls = await Promise.all(imageUrlPromises);

    const annotatedImageUrlPromises: Promise<GetFileUrlResponse>[] = [];
    for (let i = 0; i < page_count; i++) {
        annotatedImageUrlPromises.push(
            getAnnotatedImageUrlForPage(vertesia, object.id, i + 1),
        );
    }
    const annotatedImageUrls = await Promise.all(annotatedImageUrlPromises);

    const instrumentedImageUrlPromises: Promise<GetFileUrlResponse>[] = [];
    for (let i = 0; i < page_count; i++) {
        instrumentedImageUrlPromises.push(
            getInstrumentedImageUrlForPage(vertesia, object.id, i + 1),
        );
    }
    const instrumentedImageUrls = await Promise.all(
        instrumentedImageUrlPromises,
    );

    const originalImageUrlPromises: Promise<GetFileUrlResponse>[] = [];
    for (let i = 0; i < page_count; i++) {
        originalImageUrlPromises.push(
            getOriginalImageUrlForPage(vertesia, object.id, i + 1),
        );
    }
    const originalImageUrls = await Promise.all(originalImageUrlPromises);

    const layoutProvider = new PageLayoutProvider(page_count);
    await layoutProvider.loadUrls(vertesia, object.id);

    const markdownProvider = new PageMarkdownProvider(page_count);
    await markdownProvider.loadUrls(vertesia, object.id);

    const xml = object.text ? cleanXml(object.text) : "";

    return {
        count: page_count,
        urls: imageUrls.map((r) => r.url),
        originalUrls: originalImageUrls.map((r) => r.url),
        annotatedUrls: annotatedImageUrls.map((r) => r.url),
        instrumentedUrls: instrumentedImageUrls.map((r) => r.url),
        layoutProvider,
        markdownProvider,
        xml,
        xmlPages: object.text ? extractXmlPages(xml) : [],
        pdfUrl,
        pdfUrlLoading: false,
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
