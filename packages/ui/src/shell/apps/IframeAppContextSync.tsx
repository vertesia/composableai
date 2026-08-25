import { useEffect } from 'react';
import { useTheme } from '../../core/components/shadcn/theme/ThemeProvider.js';
import { useLanguage } from '../../i18n/LanguageProvider.js';
import {
    IFRAME_APP_CONTEXT_REQUEST,
    IFRAME_APP_HOST_ORIGIN_PARAM,
    IFRAME_APP_LOCATION_CHANGE,
    type IframeAppContextRequest,
    type IframeAppLocationChange,
    isIframeAppContext,
    isIframeAppNavigate,
    resolveIframeHostOrigin,
} from './iframe-auth.js';

function preserveIframeHostOrigin(url: string | URL | null | undefined): string | URL | null | undefined {
    if (url === null || url === undefined) return url;
    const hostOrigin = new URL(window.location.href).searchParams.get(IFRAME_APP_HOST_ORIGIN_PARAM);
    if (!hostOrigin) return url;

    try {
        const target = new URL(url, window.location.href);
        if (target.origin !== window.location.origin) return url;
        target.searchParams.set(IFRAME_APP_HOST_ORIGIN_PARAM, hostOrigin);
        return target;
    } catch {
        return url;
    }
}

/** Applies context and navigation supplied by an embedding Studio without changing standalone preferences. */
export function IframeAppContextSync() {
    const { setTheme } = useTheme();
    const { setLanguage } = useLanguage();

    useEffect(() => {
        const parentOrigin = resolveIframeHostOrigin();
        if (!parentOrigin) return;

        const reportLocation = () => {
            const message = {
                type: IFRAME_APP_LOCATION_CHANGE,
                url: window.location.href,
            } satisfies IframeAppLocationChange;
            window.parent.postMessage(message, parentOrigin);
        };

        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;
        const pushState: History['pushState'] = (data, unused, url) => {
            originalPushState.call(window.history, data, unused, preserveIframeHostOrigin(url));
            reportLocation();
        };
        const replaceState: History['replaceState'] = (data, unused, url) => {
            originalReplaceState.call(window.history, data, unused, preserveIframeHostOrigin(url));
            reportLocation();
        };
        window.history.pushState = pushState;
        window.history.replaceState = replaceState;

        const onMessage = (event: MessageEvent<unknown>) => {
            if (event.source !== window.parent || event.origin !== parentOrigin) return;
            if (isIframeAppContext(event.data)) {
                const context = event.data;
                setTheme(context.theme, { persist: false });
                setLanguage(context.language, { persist: false });
                return;
            }
            if (isIframeAppNavigate(event.data)) {
                let target: URL;
                try {
                    target = new URL(event.data.url, window.location.href);
                } catch {
                    return;
                }
                if (target.origin !== window.location.origin) return;
                if (target.href === window.location.href) {
                    // Acknowledge no-op navigation so the host does not wait forever and suppress later app routing.
                    reportLocation();
                    return;
                }
                window.history.replaceState(window.history.state, '', target);
                window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
            }
        };
        const request = { type: IFRAME_APP_CONTEXT_REQUEST } satisfies IframeAppContextRequest;
        window.addEventListener('message', onMessage);
        window.addEventListener('popstate', reportLocation);
        window.addEventListener('hashchange', reportLocation);
        window.parent.postMessage(request, parentOrigin);
        reportLocation();
        return () => {
            window.removeEventListener('message', onMessage);
            window.removeEventListener('popstate', reportLocation);
            window.removeEventListener('hashchange', reportLocation);
            if (window.history.pushState === pushState) window.history.pushState = originalPushState;
            if (window.history.replaceState === replaceState) window.history.replaceState = originalReplaceState;
        };
    }, [setLanguage, setTheme]);

    return null;
}
