import { useEffect } from 'react';
import { useTheme } from '../../core/components/shadcn/theme/ThemeProvider.js';
import { useLanguage } from '../../i18n/LanguageProvider.js';
import { IFRAME_APP_CONTEXT_REQUEST, type IframeAppContextRequest, isIframeAppContext } from './iframe-auth.js';

function updateWithoutPersisting(storageKey: string, update: () => void) {
    const previous = localStorage.getItem(storageKey);
    update();
    if (previous === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, previous);
}

/** Applies presentation state supplied by an embedding Studio without changing standalone preferences. */
export function IframeAppContextSync() {
    const { setTheme } = useTheme();
    const { setLanguage } = useLanguage();

    useEffect(() => {
        if (window.parent === window || !document.referrer) return;

        let parentOrigin: string;
        try {
            parentOrigin = new URL(document.referrer).origin;
        } catch {
            return;
        }

        const onMessage = (event: MessageEvent<unknown>) => {
            if (event.source !== window.parent || event.origin !== parentOrigin || !isIframeAppContext(event.data)) {
                return;
            }
            const context = event.data;
            updateWithoutPersisting('vite-ui-theme', () => setTheme(context.theme));
            updateWithoutPersisting('vertesia-ui-language', () => setLanguage(context.language));
        };
        const request = { type: IFRAME_APP_CONTEXT_REQUEST } satisfies IframeAppContextRequest;
        window.addEventListener('message', onMessage);
        window.parent.postMessage(request, parentOrigin);
        return () => window.removeEventListener('message', onMessage);
    }, [setLanguage, setTheme]);

    return null;
}
