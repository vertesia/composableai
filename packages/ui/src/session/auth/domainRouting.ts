declare global {
    interface Window {
        AUTH_MODE?: 'firebase' | 'central';
    }
}

export function shouldUseFirebaseAuth(_hostname?: string) {
    return window.AUTH_MODE === 'firebase';
}

export function shouldRedirectToCentralAuth(_hostname?: string) {
    return !shouldUseFirebaseAuth();
}
