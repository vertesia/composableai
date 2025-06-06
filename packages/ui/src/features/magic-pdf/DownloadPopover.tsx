import { ContentObject } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { Popover } from "@vertesia/ui/widgets";
import { CloudDownload } from "lucide-react";
import { getResourceUrl } from "./PdfPageProvider";

interface DownloadPopoverProps {
    object: ContentObject;
}
export function DownloadPopover({ object }: DownloadPopoverProps) {
    const { client } = useUserSession()
    const onDownload = (name: string) => {
        getResourceUrl(client, object.id, name).then(url => window.open(url, '_blank'));
    }
    return (
        <div className="absolute bottom-[58px] right-[20px] w-[36px] h-[36px] cursor-pointer text-indigo-400 border-indigo-400 hover:border-indigo-500 hover:text-indigo-500 border-2 rounded-full shadow-xs flex items-center justify-center">
            <Popover strategy='absolute' placement='top-end' zIndex={100} offset={20}>
                <Popover.Trigger click>
                    <CloudDownload className='size-6' />

                </Popover.Trigger>
                <Popover.Content>
                    <div className="rounded-md shadow-md border border-gray-100 bg-white dark:bg-slate-50 dark:border-slate-100 min-w-[200px] flex flex-col divide-y">
                        <button className="p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-100" onClick={() => onDownload("annotated.pdf")}>annotated.pdf</button>
                        <button className="p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-100" onClick={() => onDownload("document.xml")}>document.xml</button>
                        <button className="p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-100" onClick={() => onDownload("analyzed-pages.json")}>analyzed-pages.json</button>
                    </div>
                </Popover.Content>
            </Popover>
        </div>
    )
}
