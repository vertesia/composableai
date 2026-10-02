import { ContentNature, type ContentObject, ImageRenditionFormat } from '@vertesia/common';
import { Button, Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useState } from 'react';
import { WEB_SUPPORTED_IMAGE_FORMATS } from './formats.js';

interface ImagePanelProps {
    /** Direct signed URL — used as-is, no resolution. */
    url?: string;
    /** Storage path; resolved via `client.files.getDownloadUrl`. */
    source?: string;
    /** ContentObject — tries the JPEG rendition first, falls back to the original if web-supported. */
    object?: ContentObject;
    /** Extra classes for the wrapper. */
    className?: string;
}

/**
 * Renders an image from a direct URL, a storage source path, or a Vertesia ContentObject.
 * Resolution priority: `url` > `source` > `object`.
 */
export function ImagePanel(props: ImagePanelProps) {
    const [attempt, setAttempt] = useState(0);
    const identity =
        props.url ??
        props.source ??
        `${props.object?.id}:${props.object?.content?.source}:${props.object?.content?.etag}`;
    return (
        <ImagePanelContent key={`${identity}:${attempt}`} {...props} onRetry={() => setAttempt((value) => value + 1)} />
    );
}

function ImagePanelContent({ url, source, object, className, onRetry }: ImagePanelProps & { onRetry: () => void }) {
    const { t } = useUITranslation();
    const [failed, setFailed] = useState(false);
    const { client } = useUserSession();
    const [imageUrl, setImageUrl] = useState<string | undefined>(url);
    const [isLoading, setIsLoading] = useState<boolean>(!url && (!!source || !!object));

    useEffect(() => {
        let active = true;
        setFailed(false);
        if (url) {
            setImageUrl(url);
            setIsLoading(false);
            return;
        }

        setImageUrl(undefined);

        const load = async () => {
            try {
                if (source) {
                    const downloadUrl = await client.files.getDownloadUrl(source);
                    if (active) setImageUrl(downloadUrl.url);
                    return;
                }

                if (!object) return;

                const isImage =
                    object.metadata?.type === ContentNature.Image || object.content?.type?.startsWith('image/');
                if (!isImage) return;

                const isOriginalWebSupported =
                    object.content?.type && WEB_SUPPORTED_IMAGE_FORMATS.includes(object.content.type);

                try {
                    const rendition = await client.objects.getRendition(object.id, {
                        format: ImageRenditionFormat.jpeg,
                        generate_if_missing: false,
                        sign_url: true,
                    });
                    if (rendition.status === 'found' && rendition.renditions?.length) {
                        if (active) setImageUrl(rendition.renditions[0]);
                        return;
                    }
                } catch {
                    // fall through to original
                }

                if (isOriginalWebSupported && object.content?.source) {
                    const downloadUrl = await client.files.getDownloadUrl(object.content.source);
                    if (active) setImageUrl(downloadUrl.url);
                }
            } catch {
                if (active) setFailed(true);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        if (source || object) {
            setIsLoading(true);
            void load();
        } else {
            setIsLoading(false);
        }
        return () => {
            active = false;
        };
    }, [url, source, object, client]);

    if (isLoading) {
        return (
            <div className={className}>
                <Spinner size="md" />
            </div>
        );
    }

    if (failed) {
        return (
            <div role="alert" className={`flex flex-col items-center gap-2 p-4 ${className ?? ''}`.trim()}>
                <p>{t('store.failedToLoadDocument')}</p>
                <Button variant="outline" onClick={onRetry}>
                    {t('agent.retry')}
                </Button>
            </div>
        );
    }

    if (!imageUrl) {
        return null;
    }

    return (
        <img
            src={imageUrl}
            alt={object?.name ?? t('intakePolicy.option.image')}
            onError={() => setFailed(true)}
            className={`w-full object-contain ${className ?? ''}`.trim()}
        />
    );
}
