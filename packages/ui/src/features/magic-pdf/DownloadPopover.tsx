import type { ContentObject } from '@vertesia/common';
import { Button } from '@vertesia/ui/core';
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

    return (
        <Button variant="ghost" size="xs" onClick={() => onDownload('document.md')} title={t('pdf.download')}>
            <Download className="size-4" />
        </Button>
    );
}
