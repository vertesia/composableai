import { ContentNature, type ContentObject, POSTER_RENDITION_NAME, type VideoMetadata } from '@vertesia/common';
import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useState } from 'react';
import { WEB_SUPPORTED_VIDEO_FORMATS } from './formats.js';

interface VideoPanelProps {
    /** Direct signed URL — used as-is, no resolution. */
    url?: string;
    /** Storage path; resolved via `client.files.getDownloadUrl`. */
    source?: string;
    /** ContentObject — picks an mp4/webm rendition or falls back to the original if web-supported. */
    object?: ContentObject;
    /** Extra classes for the wrapper. */
    className?: string;
}

/**
 * Renders a video from a direct URL, a storage source path, or a Vertesia ContentObject.
 * Resolution priority: `url` > `source` > `object`. Poster image only resolves in object mode.
 */
export function VideoPanel({ url, source, object, className }: VideoPanelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [videoUrl, setVideoUrl] = useState<string | undefined>(url);
    const [posterUrl, setPosterUrl] = useState<string>();
    const [isLoading, setIsLoading] = useState<boolean>(!url && (!!source || !!object));

    const metadata = object?.metadata as VideoMetadata | undefined;
    const renditions = metadata?.renditions || [];
    const webRendition =
        renditions.find((r) => r.content.type === 'video/mp4') ||
        renditions.find((r) => r.content.type === 'video/webm');
    const isOriginalWebSupported = object?.content?.type && WEB_SUPPORTED_VIDEO_FORMATS.includes(object.content.type);
    const poster = renditions.find((r) => r.name === POSTER_RENDITION_NAME);
    const showsObjectFallbackEmpty =
        !!object && object.metadata?.type === ContentNature.Video && !webRendition && !isOriginalWebSupported;

    useEffect(() => {
        if (url) {
            setVideoUrl(url);
            setIsLoading(false);
            return;
        }

        setVideoUrl(undefined);
        setPosterUrl(undefined);

        const load = async () => {
            try {
                if (source) {
                    const downloadUrl = await client.files.getDownloadUrl(source);
                    setVideoUrl(downloadUrl.url);
                    return;
                }

                if (!object) return;
                if (object.metadata?.type !== ContentNature.Video) return;

                let downloadUrl: Awaited<ReturnType<typeof client.files.getDownloadUrl>> | undefined;
                if (webRendition?.content?.source) {
                    downloadUrl = await client.files.getDownloadUrl(webRendition.content.source);
                } else if (isOriginalWebSupported && object.content?.source) {
                    downloadUrl = await client.files.getDownloadUrl(object.content.source);
                }
                if (downloadUrl) {
                    setVideoUrl(downloadUrl.url);
                }
            } catch (error) {
                console.error('Failed to get video URL', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (source || object) {
            setIsLoading(true);
            void load();
        } else {
            setIsLoading(false);
        }
    }, [url, source, object, webRendition, isOriginalWebSupported, client]);

    useEffect(() => {
        if (!poster?.content?.source) return;
        client.files
            .getDownloadUrl(poster.content.source)
            .then((response) => setPosterUrl(response.url))
            .catch((error) => console.error('Failed to load poster image', error));
    }, [poster, client]);

    if (showsObjectFallbackEmpty) {
        return (
            <div className={`flex justify-center items-center h-[400px] text-muted ${className ?? ''}`.trim()}>
                <div className="text-center">
                    <p>{t('store.noVideoRendition')}</p>
                    <p className="text-sm mt-2">{t('store.videoFormatRequired')}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`flex justify-center items-center h-[400px] ${className ?? ''}`.trim()}>
                <Spinner size="md" />
            </div>
        );
    }

    if (!videoUrl) {
        return (
            <div className={`flex justify-center items-center h-[400px] text-muted ${className ?? ''}`.trim()}>
                Failed to load video
            </div>
        );
    }

    return (
        // biome-ignore lint/a11y/useMediaCaption: caption tracks are not authored for user-uploaded media; falls back to browser controls
        <video
            src={videoUrl}
            poster={posterUrl}
            controls
            className={`w-full h-full object-contain ${className ?? ''}`.trim()}
        >
            Your browser does not support the video tag.
        </video>
    );
}
