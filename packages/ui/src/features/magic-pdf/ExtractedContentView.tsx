import { JSONCode, XMLViewer, MarkdownRenderer } from '@vertesia/ui/widgets';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from "react";
import { useMagicPdfContext } from "./MagicPdfProvider";
import { ViewType } from "./types";

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <div className={`flex items-center justify-center ${className || ''}`}>
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
    );
}


interface ExtractedContentViewProps {
    pageNumber: number;
    viewType: ViewType;
}
export function ExtractedContentView({ viewType, pageNumber }: ExtractedContentViewProps) {
    switch (viewType) {
        case "json":
            return <JsonPageLayoutView pageNumber={pageNumber} />;
        case "markdown":
            return <MarkdownPageView pageNumber={pageNumber} />;
        default:
            return <XmlPageView pageNumber={pageNumber} />;
    }
}

interface XmlPageViewProps {
    pageNumber: number;
}
function XmlPageView({ pageNumber }: XmlPageViewProps) {
    const { xmlPages: pages } = useMagicPdfContext();
    return (
        <div className="px-4 py-2">
            <XMLViewer xml={pages[pageNumber - 1]} collapsible />
        </div>
    )
}

interface JsonPageLayoutViewProps {
    pageNumber: number;
}
function JsonPageLayoutView({ pageNumber }: JsonPageLayoutViewProps) {
    const [content, setContent] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { layoutProvider } = useMagicPdfContext();

    useEffect(() => {
        setLoading(true);
        setError(null);
        layoutProvider.getPageLayout(pageNumber)
            .then((layoutContent) => {
                setContent(layoutContent ? JSON.parse(layoutContent) : null);
                setLoading(false);
            })
            .catch((err: Error) => {
                console.error(err);
                setError(err.message || 'Failed to load layout');
                setLoading(false);
            });
    }, [pageNumber, layoutProvider]);

    if (loading) {
        return (
            <div className="px-4 py-8">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-2 text-red-500 text-sm">
                {error}
            </div>
        );
    }

    return content ? <JSONCode className="w-full" data={content} /> : null;
}

interface MarkdownPageViewProps {
    pageNumber: number;
}
function MarkdownPageView({ pageNumber }: MarkdownPageViewProps) {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { markdownProvider } = useMagicPdfContext();

    useEffect(() => {
        setLoading(true);
        setError(null);
        markdownProvider.getPageMarkdown(pageNumber)
            .then((md) => {
                setContent(md);
                setLoading(false);
            })
            .catch((err: Error) => {
                console.error(err);
                setError(err.message || 'Failed to load markdown');
                setLoading(false);
            });
    }, [pageNumber, markdownProvider]);

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-2">
                <LoadingSpinner />
                <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-2 text-red-500 text-sm">
                {error}
            </div>
        );
    }

    return (
        <div className="px-4 py-2 prose prose-sm max-w-none dark:prose-invert">
            {content ? <MarkdownRenderer>{content}</MarkdownRenderer> : <div>No markdown content available</div>}
        </div>
    )
}
