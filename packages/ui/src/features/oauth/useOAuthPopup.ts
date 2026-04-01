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

        // Open OAuth authorization in centered popup window
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

        // Listen for message from OAuth callback page
        const handleMessage = (event: MessageEvent) => {
            // Verify origin for security
            if (event.origin !== window.location.origin) {
                return;
            }

            // Validate message structure before processing
            if (!isOAuthMessage(event.data)) {
                return;
            }

            messageReceived = true;
            window.removeEventListener('message', handleMessage);
            if (intervalId) clearInterval(intervalId);

            // Call completion callback using ref to get latest version
            onCompleteRef.current();

            if (!event.data.success && event.data.error) {
                onErrorRef.current?.(event.data.error);
            }

            cleanupRef.current = null;
        };

        window.addEventListener('message', handleMessage);

        // Fallback: Poll for popup closure in case message is not received
        // Only set up polling if we have a reference to the popup
        if (popup) {
            intervalId = setInterval(() => {
                if (popup.closed) {
                    if (intervalId) clearInterval(intervalId);
                    window.removeEventListener('message', handleMessage);

                    // Only reload if we didn't already receive a message
                    if (!messageReceived) {
                        onCompleteRef.current();
                    }

                    cleanupRef.current = null;
                }
            }, 1000);
        }

        // Store cleanup function
        cleanupRef.current = () => {
            window.removeEventListener('message', handleMessage);
            if (intervalId) clearInterval(intervalId);
        };
    };

    return { openOAuthPopup };
}
