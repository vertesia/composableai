import { ContentObject, DocumentMetadata } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { Popover } from "@vertesia/ui/widgets";
import { Download } from "lucide-react";
import { getResourceUrl } from "./PdfPageProvider";

interface DownloadPopoverProps {
    object: ContentObject;
}
export function DownloadPopover({ object }: DownloadPopoverProps) {
    const { client } = useUserSession()
    const onDownload = (name: string) => {
        getResourceUrl(client, object.id, name).then(url => window.open(url, '_blank'));
    }

    const getProcessorType = (): string => {
        if (object.metadata?.type === "document") {
            const docMetadata = object.metadata as DocumentMetadata;
            return docMetadata.content_processor?.type || "xml";
        }
        return "xml"; // default
    };

    const processorType = getProcessorType();

    const buttonClass = "p-2 cursor-pointer hover:bg-muted text-left text-sm";
    const iconButtonClass = "w-5 h-5 cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-center";

    // For markdown processor, only one download option - render simple button
    if (processorType === "markdown") {
        return (
            <button
                className={iconButtonClass}
                onClick={() => onDownload("document.md")}
                title="Download document.md"
            >
                <Download className='size-4' />
            </button>
        );
    }

    // Default XML processor - multiple options, use popover
    return (
        <Popover strategy='absolute' placement='bottom-start' zIndex={100} offset={8}>
            <Popover.Trigger click>
                <button className={iconButtonClass}>
                    <Download className='size-4' />
                </button>
            </Popover.Trigger>
            <Popover.Content>
                <div className="rounded-md shadow-md border border-border bg-popover min-w-[200px] flex flex-col divide-y divide-border">
                    <button className={buttonClass} onClick={() => onDownload("annotated.pdf")}>
                        annotated.pdf
                    </button>
                    <button className={buttonClass} onClick={() => onDownload("document.xml")}>
                        document.xml
                    </button>
                    <button className={buttonClass} onClick={() => onDownload("analyzed-pages.json")}>
                        analyzed-pages.json
                    </button>
                </div>
            </Popover.Content>
        </Popover>
    )
}
