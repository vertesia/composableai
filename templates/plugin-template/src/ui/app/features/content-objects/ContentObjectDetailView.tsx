import type { ContentObject } from '@vertesia/common';
import { Badge, ErrorBox, Spinner, useFetch } from '@vertesia/ui/core';
import {
    AudioPanel,
    GenericPageNavHeader,
    ImagePanel,
    SimplePdfViewer,
    VideoPanel,
    WEB_SUPPORTED_AUDIO_FORMATS,
    WEB_SUPPORTED_IMAGE_FORMATS,
    WEB_SUPPORTED_VIDEO_FORMATS,
} from '@vertesia/ui/features';
import { useLocaleFormat, useUITranslation } from '@vertesia/ui/i18n';
import { NavLink, useParams } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { statusVariant } from './utils';

const PDF_MIME_TYPES = new Set(['application/pdf']);

interface MetadataRowProps {
    label: string;
    children: React.ReactNode;
}

function MetadataRow({ label, children }: MetadataRowProps) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="text-sm wrap-break-word">{children}</span>
        </div>
    );
}

interface PreviewProps {
    object: ContentObject;
    t: (key: string) => string;
}

function Preview({ object, t }: PreviewProps) {
    const mime = object.content?.type;
    if (mime && PDF_MIME_TYPES.has(mime)) {
        return <SimplePdfViewer object={object} className="h-full w-full" />;
    }
    if (mime && WEB_SUPPORTED_IMAGE_FORMATS.includes(mime)) {
        return <ImagePanel object={object} className="h-full w-full" />;
    }
    if (mime && WEB_SUPPORTED_VIDEO_FORMATS.includes(mime)) {
        return <VideoPanel object={object} className="h-full w-full" />;
    }
    if (mime && WEB_SUPPORTED_AUDIO_FORMATS.includes(mime)) {
        return <AudioPanel object={object} className="h-full w-full" />;
    }
    return (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground p-6 text-center">
            {t('objects.detail.previewUnsupported')}
        </div>
    );
}

export function ContentObjectDetailView() {
    const { t } = useUITranslation();
    const { formatDateTime } = useLocaleFormat();
    const { client } = useUserSession();
    const { id } = useParams() as { id?: string };

    const {
        data: object,
        isLoading,
        error,
    } = useFetch<ContentObject | undefined>(
        () => (id ? client.store.objects.retrieve(id) : Promise.resolve(undefined)),
        [id],
    );

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <ErrorBox title={t('objects.detail.loadError')}>{String(error)}</ErrorBox>
            </div>
        );
    }

    if (!object) {
        return (
            <div className="p-4">
                <ErrorBox title={t('objects.detail.notFound')}>{id ?? ''}</ErrorBox>
            </div>
        );
    }

    const properties = object.properties as Record<string, unknown> | undefined;
    const fullName = object.name || object.id;

    return (
        <div className="flex flex-col h-full">
            <GenericPageNavHeader
                useDynamicBreadcrumbs={false}
                breadcrumbs={[
                    <NavLink key="root" href="/objects">
                        {t('nav.objects')}
                    </NavLink>,
                    <span key="current" title={fullName}>
                        <span className="inline-block align-middle max-w-[60ch] truncate">{fullName}</span>
                    </span>,
                ]}
            />
            <div className="flex flex-col md:flex-row gap-4 p-4 flex-1 min-h-0">
                <aside className="w-full md:w-80 shrink-0 overflow-y-auto rounded-md border border-border bg-card p-4 flex flex-col gap-3">
                    <MetadataRow label={t('objects.col.status')}>
                        {object.status ? (
                            <Badge variant={statusVariant(object.status)}>{t(`objects.status.${object.status}`)}</Badge>
                        ) : (
                            '—'
                        )}
                    </MetadataRow>
                    <MetadataRow label={t('objects.col.type')}>{object.type?.name ?? '—'}</MetadataRow>
                    <MetadataRow label={t('objects.detail.mimeType')}>
                        <code className="text-xs">{object.content?.type ?? '—'}</code>
                    </MetadataRow>
                    <MetadataRow label={t('objects.col.updated')}>{formatDateTime(object.updated_at)}</MetadataRow>
                    <MetadataRow label={t('objects.detail.created')}>{formatDateTime(object.created_at)}</MetadataRow>
                    {properties && Object.keys(properties).length > 0 && (
                        <MetadataRow label={t('objects.detail.properties')}>
                            <pre className="text-xs whitespace-pre-wrap wrap-break-word bg-muted/40 rounded p-2 max-h-64 overflow-auto">
                                {JSON.stringify(properties, null, 2)}
                            </pre>
                        </MetadataRow>
                    )}
                </aside>
                <section className="flex-1 min-h-0 rounded-md border border-border bg-card overflow-hidden">
                    <Preview object={object} t={t} />
                </section>
            </div>
        </div>
    );
}
