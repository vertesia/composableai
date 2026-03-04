import { useState, createContext, useContext, useCallback, ReactNode } from "react";
import { X, ExternalLink } from "lucide-react";

interface ImageLightboxContextValue {
    openImage: (src: string, alt?: string) => void;
    closeImage: () => void;
}

const ImageLightboxContext = createContext<ImageLightboxContextValue | null>(null);

export function useImageLightbox() {
    const ctx = useContext(ImageLightboxContext);
    if (!ctx) {
        // Return a fallback that opens in new tab if no provider
        return {
            openImage: (src: string) => window.open(src, "_blank"),
            closeImage: () => {},
        };
    }
    return ctx;
}

interface ImageLightboxProviderProps {
    children: ReactNode;
}

export function ImageLightboxProvider({ children }: ImageLightboxProviderProps) {
    const [image, setImage] = useState<{ src: string; alt?: string } | null>(null);

    const openImage = useCallback((src: string, alt?: string) => {
        setImage({ src, alt });
    }, []);

    const closeImage = useCallback(() => {
        setImage(null);
    }, []);

    return (
        <ImageLightboxContext.Provider value={{ openImage, closeImage }}>
            {children}
            {image && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={closeImage}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img
                            src={image.src}
                            alt={image.alt || "Enlarged view"}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                        {/* Close button */}
                        <button
                            className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                            onClick={closeImage}
                            title="Close"
                        >
                            <X className="size-6" />
                        </button>
                        {/* Open in new tab button */}
                        <a
                            href={image.src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in new tab"
                        >
                            <ExternalLink className="size-5" />
                        </a>
                    </div>
                </div>
            )}
        </ImageLightboxContext.Provider>
    );
}

// Clickable image component that opens in lightbox
interface LightboxImageProps {
    src: string;
    alt?: string;
    className?: string;
}

export function LightboxImage({ src, alt, className }: LightboxImageProps) {
    const { openImage } = useImageLightbox();

    return (
        <img
            src={src}
            alt={alt}
            className={`cursor-pointer hover:opacity-90 transition-opacity ${className || ""}`}
            onClick={(e) => {
                e.stopPropagation();
                openImage(src, alt);
            }}
        />
    );
}
