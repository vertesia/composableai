import { Button, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { Download } from 'lucide-react';
import { useDownloadFile } from '../store/objects/components/useDownloadFile.js';

interface DownloadPopoverProps {
    object: { id: string };
}
export function DownloadPopover({ object }: DownloadPopoverProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const { downloadFromContentSource } = useDownloadFile({ client, toast: useToast() });
    const onDownload = (name: string) => void downloadFromContentSource(`magic-pdf/${object.id}/${name}`, name);

    return (
        <Button variant="ghost" size="xs" onClick={() => onDownload('document.md')} title={t('pdf.download')}>
            <Download className="size-4" />
        </Button>
    );
}
