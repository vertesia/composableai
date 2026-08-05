import type { ContentObject, DocumentMetadata } from '@vertesia/common';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { Download } from 'lucide-react';
import { getResourceUrl } from './MagicPdfProvider';

interface DownloadPopoverProps {
    object: ContentObject;
}
export function DownloadPopover({ object }: DownloadPopoverProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const onDownload = (name: string) => {
        void getResourceUrl(client, object.id, name).then((url) => window.open(url, '_blank'));
    };

    const getProcessorType = (): string => {
        if (object.metadata?.type === 'document') {
            const docMetadata = object.metadata as DocumentMetadata;
            return docMetadata.content_processor?.type || 'xml';
        }
        return 'xml'; // default
    };

    const processorType = getProcessorType();

    const buttonClass = 'p-2 cursor-pointer hover:bg-muted text-start text-sm';

    // For markdown processor, only one download option - render simple button
    if (processorType === 'markdown') {
        return (
            <Button variant="ghost" size="xs" onClick={() => onDownload('document.md')} title={t('pdf.download')}>
                <Download className="size-4" />
            </Button>
        );
    }

    // Default XML processor - multiple options, use popover
    return (
        <Popover>
            <PopoverTrigger>
                <Button variant="ghost" size="xs" title={t('pdf.download')}>
                    <Download className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-auto">
                <div className="min-w-[200px] flex flex-col divide-y divide-border">
                    <Button variant="unstyled" className={buttonClass} onClick={() => onDownload('annotated.pdf')}>
                        annotated.pdf
                    </Button>
                    <Button variant="unstyled" className={buttonClass} onClick={() => onDownload('document.xml')}>
                        document.xml
                    </Button>
                    <Button
                        variant="unstyled"
                        className={buttonClass}
                        onClick={() => onDownload('analyzed-pages.json')}
                    >
                        analyzed-pages.json
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
