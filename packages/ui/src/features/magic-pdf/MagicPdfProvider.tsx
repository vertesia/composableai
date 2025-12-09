import { useUserSession } from "@vertesia/ui/session";
import { VertesiaClient } from "@vertesia/client";
import {
    ContentObject,
    DocumentMetadata,
    PDF_RENDITION_NAME,
} from "@vertesia/common";
import React, { createContext, useEffect, useState } from "react";

const DEFAULT_PAGE_COUNT = 10;
const ADVANCED_PROCESSING_PREFIX = "magic-pdf";

export enum ImageType {
    original = 'original',
    instrumented = 'instrumented',
}

interface MagicPdfContextValue {
    count: number;
    layoutProvider: PageLayoutProvider;
    markdownProvider: PageMarkdownProvider;
    imageProvider: PageImageProvider;
    xml: string;
    xmlPages: string[];
    pdfUrl: string;
    pdfUrlLoading: boolean;
}

/** Provider for lazy-loading page images on demand */
export class PageImageProvider {
    private cache: Map<string, string> = new Map();
    private pending: Map<string, Promise<string>> = new Map();

    constructor(
        private client: VertesiaClient,
        private objectId: string,
        public totalPages: number
    ) {}

    private getCacheKey(page: number, type: ImageType): string {
        return `${type}-${page}`;
    }

    /** Get the URL for a specific page and image type, fetching lazily if needed */
    async getPageImageUrl(page: number, type: ImageType): Promise<string> {
        const key = this.getCacheKey(page, type);

        // Return cached URL if available
        const cached = this.cache.get(key);
        if (cached) return cached;

        // Return pending promise if already fetching
        const pending = this.pending.get(key);
        if (pending) return pending;

        // Fetch the URL
        const promise = this.fetchImageUrl(page, type);
        this.pending.set(key, promise);

        try {
            const url = await promise;
            this.cache.set(key, url);
            return url;
        } finally {
            this.pending.delete(key);
        }
    }

    private async fetchImageUrl(page: number, type: ImageType): Promise<string> {
        const path = this.getImagePath(page, type);
        const response = await this.client.files.getDownloadUrl(path);
        return response.url;
    }

    private getImagePath(page: number, type: ImageType): string {
        const basePath = `${ADVANCED_PROCESSING_PREFIX}/${this.objectId}/pages`;
        switch (type) {
            case ImageType.original:
                return `${basePath}/page-${page}.original.jpg`;
            case ImageType.instrumented:
                return `${basePath}/page-${page}.instrumented.jpg`;
        }
    }
}

class PageLayoutProvider {
    private cache: Map<number, string> = new Map();
    private pending: Map<number, Promise<string>> = new Map();

    constructor(
        private client: VertesiaClient,
        private objectId: string,
        public totalPages: number
    ) {}

    async getPageLayout(page: number): Promise<string> {
        // Return cached content if available
        const cached = this.cache.get(page);
        if (cached !== undefined) return cached;

        // Return pending promise if already fetching
        const pending = this.pending.get(page);
        if (pending) return pending;

        // Fetch the layout
        const promise = this.fetchPageLayout(page);
        this.pending.set(page, promise);

        try {
            const content = await promise;
            this.cache.set(page, content);
            return content;
        } finally {
            this.pending.delete(page);
        }
    }

    private async fetchPageLayout(page: number): Promise<string> {
        const path = `${ADVANCED_PROCESSING_PREFIX}/${this.objectId}/pages/page-${page}.layout.json`;
        const response = await this.client.files.getDownloadUrl(path);
        const result = await fetch(response.url, { method: "GET" });
        if (!result.ok) {
            throw new Error("Failed to fetch json layout: " + result.statusText);
        }
        return result.text();
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

const MagicPdfContext = createContext<MagicPdfContextValue | undefined>(undefined);

interface MagicPdfProviderProps {
    object: ContentObject;
    children: React.ReactNode;
}
export function MagicPdfProvider({ children, object }: MagicPdfProviderProps) {
    const { client } = useUserSession();
    const page_count = (object.metadata as DocumentMetadata).page_count || DEFAULT_PAGE_COUNT;
    const isMarkdownProcessor = (object.metadata as DocumentMetadata)?.content_processor?.type === 'markdown';

    // Create initial context immediately (synchronously) for both processor types
    const [info, setInfo] = useState<MagicPdfContextValue>(() => {
        const markdownProvider = new PageMarkdownProvider(page_count);
        if (isMarkdownProcessor && object.text) {
            markdownProvider.initFromContent(object.text);
        }
        const xml = object.text ? cleanXml(object.text) : "";
        return {
            count: page_count,
            layoutProvider: new PageLayoutProvider(client, object.id, page_count),
            markdownProvider,
            imageProvider: new PageImageProvider(client, object.id, page_count),
            xml,
            xmlPages: object.text ? extractXmlPages(xml) : [],
            pdfUrl: '',
            pdfUrlLoading: true,
        };
    });

    useEffect(() => {
        if (isMarkdownProcessor) {
            // For markdown processor, fetch the PDF URL lazily
            // Priority: PDF rendition > source (only if source is PDF)
            const metadata = object.metadata as DocumentMetadata;
            const pdfRendition = metadata?.renditions?.find(r => r.name === PDF_RENDITION_NAME);
            const isPdfSource = object.content?.type === 'application/pdf';
            const sourceToResolve = pdfRendition?.content?.source || (isPdfSource ? object.content?.source : undefined);

            if (sourceToResolve) {
                client.store.objects.getDownloadUrl(sourceToResolve, undefined, 'inline')
                    .then((response) => {
                        setInfo(prev => ({ ...prev, pdfUrl: response.url, pdfUrlLoading: false }));
                    })
                    .catch((e) => {
                        console.warn('Failed to get PDF URL:', e);
                        setInfo(prev => ({ ...prev, pdfUrlLoading: false }));
                    });
            } else {
                setInfo(prev => ({ ...prev, pdfUrlLoading: false }));
            }
        } else {
            // For XML processor, no pre-loading needed - images load on demand
            setInfo(prev => ({ ...prev, pdfUrlLoading: false }));
        }
    }, [object.id, client, isMarkdownProcessor, page_count]);

    return (
        <MagicPdfContext.Provider value={info}>
            {children}
        </MagicPdfContext.Provider>
    );
}

export function getResourceUrl(
    vertesia: VertesiaClient,
    objectId: string,
    name: string,
): Promise<string> {
    return vertesia.files
        .getDownloadUrl(`${ADVANCED_PROCESSING_PREFIX}/${objectId}/${name}`)
        .then((r) => r.url);
}

export function useMagicPdfContext() {
    const context = React.useContext(MagicPdfContext);
    if (!context) {
        throw new Error(
            "useMagicPdfContext must be used within a MagicPdfProvider",
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
