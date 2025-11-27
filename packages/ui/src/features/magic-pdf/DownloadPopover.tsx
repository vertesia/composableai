import { ContentObject, DocumentMetadata } from "@vertesia/common";
import { Button } from "@vertesia/ui/core";
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

    // For markdown processor, only one download option - render simple button
    if (processorType === "markdown") {
        return (
            <Button
                variant="ghost"
                size="xs"
                onClick={() => onDownload("document.md")}
                alt="Download"
            >
                <Download className='size-4' />
            </Button>
        );
    }

    // Default XML processor - multiple options, use popover
    return (
        <Popover strategy='absolute' placement='bottom-start' zIndex={100} offset={8}>
            <Popover.Trigger click>
                <Button
                    variant="ghost"
                    size="xs"
                    alt="Download"
                >
                    <Download className='size-4' />
                </Button>
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
