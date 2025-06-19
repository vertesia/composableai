import { JSONCode, Theme, XMLViewer } from '@vertesia/ui/widgets';
import { useEffect, useLayoutEffect, useState } from "react";
import { usePdfPagesInfo } from "./PdfPageProvider";
import { ViewType } from "./types";


const darkTheme: Theme = {
    attributeKeyColor: '#FFD700',
    attributeValueColor: '#FF4500',
    tagColor: '#87CEFA',
    textColor: '#00FF00',
    separatorColor: '#FFD700',
    commentColor: "#BEBEBE",
    cdataColor: "#33CC66",
}

interface TextPageViewProps {
    pageNumber: number;
    viewType: ViewType;
}
export function TextPageView({ viewType, pageNumber }: TextPageViewProps) {
    return viewType === "json" ? <JsonPageLayoutView pageNumber={pageNumber} /> : <XmlPageView pageNumber={pageNumber} />
}

interface XmlPageViewProps {
    pageNumber: number;
}
function XmlPageView({ pageNumber }: XmlPageViewProps) {
    const [theme, setTheme] = useState<Theme>();
    const { xmlPages: pages } = usePdfPagesInfo();
    useLayoutEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onMediaChange = (event: MediaQueryListEvent) => {
            setTheme(event.matches ? darkTheme : undefined);
        };
        media.addEventListener('change', onMediaChange);
        media.matches && setTheme(darkTheme);
        return () => {
            media.removeEventListener('change', onMediaChange);
        }
    }, []);
    return (
        <div className="px-4 py-2">
            <XMLViewer xml={pages[pageNumber - 1]} collapsible theme={theme} />
        </div>
    )
}

interface JsonPageLayoutViewProps {
    pageNumber: number;
}
function JsonPageLayoutView({ pageNumber }: JsonPageLayoutViewProps) {
    const [content, setContent] = useState<any>();
    const { layoutProvider } = usePdfPagesInfo();
    useEffect(() => {
        layoutProvider.getPageLayout(pageNumber).then(content => setContent(content ? JSON.parse(content) : undefined)).catch(err => {
            console.error(err);
            setContent(undefined);
        });
    }, [pageNumber]);
    return (
        content && <JSONCode className="w-full" data={content} />
    )
}
