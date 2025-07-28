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
    annotatedUrls: string[];
    instrumentedUrls: string[];
    layoutProvider: PageLayoutProvider;
    markdownProvider: PageMarkdownProvider;
    xml: string;
    xmlPages: string[];
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
    markdownUrls: string[] = [];
    cache: string[];
    constructor(public totalPages: number) {
        this.cache = new Array<string>(totalPages);
    }
    async loadUrls(vertesia: VertesiaClient, objectId: string) {
        const markdownPromises: Promise<GetFileUrlResponse>[] = [];
        for (let i = 0; i < this.totalPages; i++) {
            markdownPromises.push(getMarkdownUrlForPage(vertesia, objectId, i + 1));
        }
        const markdownUrls = await Promise.all(markdownPromises);
        this.markdownUrls = markdownUrls.map((r) => r.url);
    }
    async getPageMarkdown(page: number) {
        const index = page - 1;
        let content = this.cache[index];
        if (content === undefined) {
            const url = this.markdownUrls[index];
            content = await fetch(url, { method: "GET" }).then((r) => {
                if (r.ok) {
                    return r.text();
                } else {
                    throw new Error(
                        "Failed to fetch markdown: " + r.statusText,
                    );
                }
            });
            this.cache[index] = content;
        }
        return content;
    }
}

const PdfPageContext = createContext<PdfPagesInfo | undefined>(undefined);

interface PdfPageProviderProps {
    object: ContentObject;
    children: React.ReactNode;
}
export function PdfPageProvider({ children, object }: PdfPageProviderProps) {
    const { client } = useUserSession();
    const [info, setInfo] = useState<PdfPagesInfo>();
    useEffect(() => {
        const page_count =
            (object.metadata as DocumentMetadata).page_count ||
            DEFAULT_PAGE_COUNT;
        getPdfPagesInfo(client, object, page_count).then(setInfo);
    }, [object.id]);

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

function getLayoutJsonPath(objectId: string, pageNumber: number) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}.layout.json`;
}

function getMarkdownPath(objectId: string, pageNumber: number) {
    return `${getBasePath(objectId)}/pages/page-${pageNumber}.mpx:ConvertPageToMarkdown.txt`;
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

function getLayoutUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getLayoutJsonPath(objectId, pageNumber),
    );
}

function getMarkdownUrlForPage(
    vertesia: VertesiaClient,
    objectId: string,
    pageNumber: number,
): Promise<GetFileUrlResponse> {
    return vertesia.files.getDownloadUrl(
        getMarkdownPath(objectId, pageNumber),
    );
}

async function getPdfPagesInfo(
    vertesia: VertesiaClient,
    object: ContentObject,
    page_count: number,
): Promise<PdfPagesInfo> {
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

    const layoutProvider = new PageLayoutProvider(page_count);
    await layoutProvider.loadUrls(vertesia, object.id);

    const markdownProvider = new PageMarkdownProvider(page_count);
    await markdownProvider.loadUrls(vertesia, object.id);

    const xml = object.text ? cleanXml(object.text) : "";

    return {
        count: page_count,
        urls: imageUrls.map((r) => r.url),
        annotatedUrls: annotatedImageUrls.map((r) => r.url),
        instrumentedUrls: instrumentedImageUrls.map((r) => r.url),
        layoutProvider,
        markdownProvider,
        xml,
        xmlPages: object.text ? extractXmlPages(xml) : [],
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
