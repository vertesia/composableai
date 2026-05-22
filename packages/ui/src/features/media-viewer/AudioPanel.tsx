import { AUDIO_RENDITION_NAME, AudioMetadata, ContentNature, ContentObject } from "@vertesia/common";
import { Spinner } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";
import { useUITranslation } from '@vertesia/ui/i18n';
import { formatDuration, WEB_SUPPORTED_AUDIO_FORMATS } from "./formats.js";

interface AudioPanelProps {
    /** Direct signed URL — used as-is, no resolution. */
    url?: string;
    /** Storage path; resolved via `client.files.getDownloadUrl`. */
    source?: string;
    /** ContentObject — uses the audio rendition or falls back to the original if web-supported. */
    object?: ContentObject;
    /** Extra classes for the wrapper. */
    className?: string;
}

/**
 * Renders an audio player from a direct URL, a storage source path, or a Vertesia ContentObject.
 * Resolution priority: `url` > `source` > `object`. Duration is shown only in object mode.
 */
export function AudioPanel({ url, source, object, className }: AudioPanelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [audioUrl, setAudioUrl] = useState<string | undefined>(url);
    const [isLoading, setIsLoading] = useState<boolean>(!url && (!!source || !!object));

    const metadata = object?.metadata as AudioMetadata | undefined;
    const renditions = metadata?.renditions || [];
    const audioRendition = renditions.find(r => r.name === AUDIO_RENDITION_NAME);
    const isOriginalWebSupported = object?.content?.type
        && WEB_SUPPORTED_AUDIO_FORMATS.includes(object.content.type);
    const showsObjectFallbackEmpty = !!object
        && object.metadata?.type === ContentNature.Audio
        && !audioRendition
        && !isOriginalWebSupported;

    useEffect(() => {
        if (url) {
            setAudioUrl(url);
            setIsLoading(false);
            return;
        }

        setAudioUrl(undefined);

        const load = async () => {
            try {
                if (source) {
                    const downloadUrl = await client.files.getDownloadUrl(source);
                    setAudioUrl(downloadUrl.url);
                    return;
                }

                if (!object) return;
                if (object.metadata?.type !== ContentNature.Audio) return;

                let downloadUrl: Awaited<ReturnType<typeof client.files.getDownloadUrl>> | undefined;
                if (audioRendition?.content?.source) {
                    downloadUrl = await client.files.getDownloadUrl(audioRendition.content.source);
                } else if (isOriginalWebSupported && object.content?.source) {
                    downloadUrl = await client.files.getDownloadUrl(object.content.source);
                }
                if (downloadUrl) {
                    setAudioUrl(downloadUrl.url);
                }
            } catch (error) {
                console.error("Failed to get audio URL", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (source || object) {
            setIsLoading(true);
            load();
        } else {
            setIsLoading(false);
        }
    }, [url, source, object, audioRendition, isOriginalWebSupported, client]);

    if (showsObjectFallbackEmpty) {
        return (
            <div className={`flex justify-center items-center h-[200px] text-muted ${className ?? ''}`.trim()}>
                <div className="text-center">
                    <p>{t('store.noAudioRendition')}</p>
                    <p className="text-sm mt-2">{t('store.audioFormatRequired')}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`flex justify-center items-center h-[200px] ${className ?? ''}`.trim()}>
                <Spinner size="md" />
            </div>
        );
    }

    if (!audioUrl) {
        return (
            <div className={`flex justify-center items-center h-[200px] text-muted ${className ?? ''}`.trim()}>
                Failed to load audio
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center gap-4 ${className ?? ''}`.trim()}>
            <audio
                src={audioUrl}
                controls
                className="w-full max-w-2xl"
            >
                Your browser does not support the audio tag.
            </audio>
            {metadata?.duration && (
                <div className="text-sm text-muted">
                    Duration: {formatDuration(metadata.duration)}
                </div>
            )}
        </div>
    );
}
