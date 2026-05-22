import { ContentNature, type ContentObject, ImageRenditionFormat } from "@vertesia/common";
import { Spinner } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useEffect, useState } from "react";
import { WEB_SUPPORTED_IMAGE_FORMATS } from "./formats.js";

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
export function ImagePanel({ url, source, object, className }: ImagePanelProps) {
    const { client } = useUserSession();
    const [imageUrl, setImageUrl] = useState<string | undefined>(url);
    const [isLoading, setIsLoading] = useState<boolean>(!url && (!!source || !!object));

    useEffect(() => {
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
                    setImageUrl(downloadUrl.url);
                    return;
                }

                if (!object) return;

                const isImage = object.metadata?.type === ContentNature.Image;
                if (!isImage) return;

                const isOriginalWebSupported = object.content?.type
                    && WEB_SUPPORTED_IMAGE_FORMATS.includes(object.content.type);

                try {
                    const rendition = await client.objects.getRendition(object.id, {
                        format: ImageRenditionFormat.jpeg,
                        generate_if_missing: false,
                        sign_url: true,
                    });
                    if (rendition.status === "found" && rendition.renditions?.length) {
                        setImageUrl(rendition.renditions[0]);
                        return;
                    }
                } catch {
                    // fall through to original
                }

                if (isOriginalWebSupported && object.content?.source) {
                    const downloadUrl = await client.files.getDownloadUrl(object.content.source);
                    setImageUrl(downloadUrl.url);
                }
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
    }, [url, source, object, client]);

    if (isLoading) {
        return (
            <div className={className}>
                <Spinner size="md" />
            </div>
        );
    }

    if (!imageUrl) {
        return null;
    }

    return (
        <img
            src={imageUrl}
            alt={object?.name}
            className={`w-full object-contain ${className ?? ''}`.trim()}
        />
    );
}
