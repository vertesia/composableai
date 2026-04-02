import { useEffect, useRef } from 'react';

export interface UseOAuthPopupOptions {
    onComplete: () => void;
    onError?: (error: string) => void;
}

/**
 * OAuth message structure from callback page
 */
interface OAuthMessage {
    type: 'oauth-complete';
    success: boolean;
    error?: string;
}

/**
 * Type guard to validate OAuth message structure
 */
function isOAuthMessage(data: unknown): data is OAuthMessage {
    return (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        data.type === 'oauth-complete' &&
        'success' in data &&
        typeof (data as OAuthMessage).success === 'boolean'
    );
}

/**
 * Hook to manage OAuth popup window with proper cleanup
 * Handles window.postMessage communication and fallback polling
 */
export function useOAuthPopup({ onComplete, onError }: UseOAuthPopupOptions) {
    const cleanupRef = useRef<(() => void) | null>(null);
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    // Keep refs up to date
    useEffect(() => {
        onCompleteRef.current = onComplete;
        onErrorRef.current = onError;
    }, [onComplete, onError]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, []);

    const openOAuthPopup = (authorizationUrl: string) => {
        // Clean up any previous OAuth flow
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        // Open OAuth authorization in centered popup window.
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            authorizationUrl,
            'oauth_popup',
            `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        let messageReceived = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        // BroadcastChannel is same-origin by spec — no origin check required.
        const channel = new BroadcastChannel('oauth-callback');

        const handleMessage = (event: MessageEvent) => {
            if (!isOAuthMessage(event.data)) {
                return;
            }

            messageReceived = true;
            channel.close();
            if (intervalId) clearInterval(intervalId);

            onCompleteRef.current();

            if (!event.data.success && event.data.error) {
                onErrorRef.current?.(event.data.error);
            }

            cleanupRef.current = null;
        };

        channel.addEventListener('message', handleMessage);

        // Poll for popup closure so the button resets if the user dismisses the popup early.
        if (popup) {
            intervalId = setInterval(() => {
                if (popup.closed) {
                    if (intervalId) clearInterval(intervalId);
                    channel.close();

                    if (!messageReceived) {
                        onCompleteRef.current();
                    }

                    cleanupRef.current = null;
                }
            }, 1000);
        }

        // Store cleanup function
        cleanupRef.current = () => {
            channel.close();
            if (intervalId) clearInterval(intervalId);
        };
    };

    return { openOAuthPopup };
}
