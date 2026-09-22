import {
    AUDIO_RENDITION_NAME,
    type AudioMetadata,
    type AudioResult,
    ContentNature,
    type ContentObject,
} from '@vertesia/common';
import { Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useState } from 'react';
import { formatDuration, WEB_SUPPORTED_AUDIO_FORMATS } from './formats.js';

interface AudioPanelProps {
    /** Direct signed URL — used as-is, no resolution. */
    url?: string;
    /** Storage path; resolved via `client.files.getDownloadUrl`. */
    source?: string;
    /** ContentObject — uses the audio rendition or falls back to the original if web-supported. */
    object?: ContentObject;
    /** Audio result metadata used to make raw PCM playable in browser media controls. */
    audio?: AudioResult;
    /** Extra classes for the wrapper. */
    className?: string;
}

export interface PcmFormat {
    sampleRate: number;
    channels: number;
}

function pcmFormat(audio?: AudioResult): PcmFormat | undefined {
    if (
        audio?.container !== 'raw' ||
        audio.codec !== 'pcm' ||
        audio.sample_encoding !== 'int16' ||
        audio.byte_order !== 'little' ||
        !audio.sample_rate ||
        !audio.channels
    ) {
        return undefined;
    }

    return { sampleRate: audio.sample_rate, channels: audio.channels };
}

/** Wrap provider PCM16-LE bytes in a WAV header so browser media controls can decode them. */
export function pcm16LeToWav(pcm: ArrayBuffer, format: PcmFormat): Blob {
    const headerSize = 44;
    const bytesPerSample = 2;
    const blockAlign = format.channels * bytesPerSample;
    const bytesPerSecond = format.sampleRate * blockAlign;
    const wav = new ArrayBuffer(headerSize + pcm.byteLength);
    const view = new DataView(wav);
    const writeAscii = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + pcm.byteLength, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, format.channels, true);
    view.setUint32(24, format.sampleRate, true);
    view.setUint32(28, bytesPerSecond, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    new Uint8Array(wav, headerSize).set(new Uint8Array(pcm));

    return new Blob([wav], { type: 'audio/wav' });
}

/**
 * Renders an audio player from a direct URL, a storage source path, or a Vertesia ContentObject.
 * Resolution priority: `url` > `source` > `object`. Duration is shown only in object mode.
 */
export function AudioPanel({ url, source, object, audio, className }: AudioPanelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [audioUrl, setAudioUrl] = useState<string | undefined>(url);
    const [isLoading, setIsLoading] = useState<boolean>(!url && (!!source || !!object));

    const metadata = object?.metadata as AudioMetadata | undefined;
    const renditions = metadata?.renditions || [];
    const audioRendition = renditions.find((r) => r.name === AUDIO_RENDITION_NAME);
    const isOriginalWebSupported = object?.content?.type && WEB_SUPPORTED_AUDIO_FORMATS.includes(object.content.type);
    const showsObjectFallbackEmpty =
        !!object && object.metadata?.type === ContentNature.Audio && !audioRendition && !isOriginalWebSupported;

    useEffect(() => {
        let generatedUrl: string | undefined;
        let cancelled = false;
        setAudioUrl(undefined);

        const setPlayableUrl = async (downloadUrl: string) => {
            const format = pcmFormat(audio);
            if (!format) {
                if (!cancelled) setAudioUrl(downloadUrl);
                return;
            }

            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch PCM audio: ${response.status}`);
            generatedUrl = URL.createObjectURL(pcm16LeToWav(await response.arrayBuffer(), format));
            if (cancelled) {
                URL.revokeObjectURL(generatedUrl);
                generatedUrl = undefined;
                return;
            }
            setAudioUrl(generatedUrl);
        };

        const load = async () => {
            try {
                if (url) {
                    await setPlayableUrl(url);
                    return;
                }

                if (source) {
                    const downloadUrl = await client.files.getDownloadUrl(source);
                    await setPlayableUrl(downloadUrl.url);
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
                    await setPlayableUrl(downloadUrl.url);
                }
            } catch (error) {
                console.error('Failed to get audio URL', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (url || source || object) {
            setIsLoading(true);
            void load();
        } else {
            setIsLoading(false);
        }
        return () => {
            cancelled = true;
            if (generatedUrl) {
                URL.revokeObjectURL(generatedUrl);
            }
        };
    }, [url, source, object, audio, audioRendition, isOriginalWebSupported, client]);

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
            {/* biome-ignore lint/a11y/useMediaCaption: caption tracks are not authored for user-uploaded media; falls back to browser controls and transcript metadata */}
            <audio src={audioUrl} controls className="w-full max-w-2xl">
                Your browser does not support the audio tag.
            </audio>
            {metadata?.duration && (
                <div className="text-sm text-muted">Duration: {formatDuration(metadata.duration)}</div>
            )}
        </div>
    );
}
