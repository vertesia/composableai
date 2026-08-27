import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n/rtl.js';

export const IFRAME_AUTH_REQUEST = 'vertesia:iframe-auth-request';
export const IFRAME_AUTH_RESPONSE = 'vertesia:iframe-auth-response';
export const IFRAME_APP_CONTEXT_REQUEST = 'vertesia:iframe-context-request';
export const IFRAME_APP_CONTEXT = 'vertesia:iframe-context';
export const IFRAME_APP_NAVIGATE = 'vertesia:iframe-navigate';
export const IFRAME_APP_LOCATION_CHANGE = 'vertesia:iframe-location-change';
export const IFRAME_APP_SLOT_PARAM = '__vertesia_slot';
export const IFRAME_APP_HOST_ORIGIN_PARAM = '__vertesia_host_origin';
export const IFRAME_APP_CONTENT_SLOT = 'content';

export interface IframeAuthRequest {
    type: typeof IFRAME_AUTH_REQUEST;
    requestId: string;
}

export interface IframeAuthResponse {
    type: typeof IFRAME_AUTH_RESPONSE;
    requestId: string;
    token?: string;
}

export interface IframeAppContextRequest {
    type: typeof IFRAME_APP_CONTEXT_REQUEST;
}

export interface IframeAppContext {
    type: typeof IFRAME_APP_CONTEXT;
    theme: 'dark' | 'light' | 'system';
    language: SupportedLanguage;
}

export interface IframeAppNavigate {
    type: typeof IFRAME_APP_NAVIGATE;
    url: string;
}

export interface IframeAppLocationChange {
    type: typeof IFRAME_APP_LOCATION_CHANGE;
    url: string;
}

export function isIframeAuthRequest(value: unknown): value is IframeAuthRequest {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<IframeAuthRequest>;
    return message.type === IFRAME_AUTH_REQUEST && typeof message.requestId === 'string' && !!message.requestId;
}

export function isIframeAuthResponse(value: unknown): value is IframeAuthResponse {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<IframeAuthResponse>;
    return (
        message.type === IFRAME_AUTH_RESPONSE &&
        typeof message.requestId === 'string' &&
        !!message.requestId &&
        (message.token === undefined || typeof message.token === 'string')
    );
}

export function isIframeAppContextRequest(value: unknown): value is IframeAppContextRequest {
    if (!value || typeof value !== 'object') return false;
    return (value as Partial<IframeAppContextRequest>).type === IFRAME_APP_CONTEXT_REQUEST;
}

export function isIframeAppContext(value: unknown): value is IframeAppContext {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<IframeAppContext>;
    return (
        message.type === IFRAME_APP_CONTEXT &&
        (message.theme === 'dark' || message.theme === 'light' || message.theme === 'system') &&
        typeof message.language === 'string' &&
        (SUPPORTED_LANGUAGES as readonly string[]).includes(message.language)
    );
}

export function isIframeAppNavigate(value: unknown): value is IframeAppNavigate {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<IframeAppNavigate>;
    return message.type === IFRAME_APP_NAVIGATE && typeof message.url === 'string' && !!message.url;
}

export function isIframeAppLocationChange(value: unknown): value is IframeAppLocationChange {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<IframeAppLocationChange>;
    return message.type === IFRAME_APP_LOCATION_CHANGE && typeof message.url === 'string' && !!message.url;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseHttpOrigin(value: string | null | undefined): URL | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
        return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback) ? url : undefined;
    } catch {
        return undefined;
    }
}

function hasEmbeddedCredentials(value: string | null | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim();
    const schemeEnd = normalized.indexOf('://');
    if (schemeEnd < 0) return false;

    const authorityStart = schemeEnd + 3;
    const authoritySuffix = normalized.slice(authorityStart);
    const authorityEnd = authoritySuffix.search(/[/?#]/);
    const authority = authorityEnd < 0 ? authoritySuffix : authoritySuffix.slice(0, authorityEnd);
    return authority.includes('@');
}

function isVertesiaStudioHost(host: string): boolean {
    if (host === 'studio.vertesia.io') return true;

    const labels = host.split('.');
    if (labels.at(-2) !== 'vertesia' || labels.at(-1) !== 'io') return false;

    const platformLabels = labels.slice(0, -2);
    const cloudIndex = platformLabels.lastIndexOf('cloud');
    if (cloudIndex >= 0 && platformLabels.length - cloudIndex <= 2) return true;

    const uiIndex = platformLabels.lastIndexOf('ui');
    return uiIndex >= 0 && platformLabels.length - uiIndex === 2;
}

function parseTrustedIframeHostOrigin(value: string | null | undefined): string | undefined {
    if (hasEmbeddedCredentials(value)) return undefined;
    const url = parseHttpOrigin(value);
    if (!url) return undefined;

    const host = url.hostname;
    const isStudioHost = isVertesiaStudioHost(host);
    const isLocalDevelopment = LOOPBACK_HOSTS.has(host) && LOOPBACK_HOSTS.has(window.location.hostname);
    return (url.protocol === 'https:' && isStudioHost) || isLocalDevelopment ? url.origin : undefined;
}

/**
 * Resolve a trusted embedding Studio origin without relying on referrer surviving a reload or auth redirect.
 * The URL value is a continuity hint rather than a trust anchor: only Studio UI host patterns are accepted, and
 * loopback parents are accepted only when the child app is also running on loopback.
 */
export function resolveIframeHostOrigin(): string | undefined {
    if (window.parent === window) return undefined;

    const explicitOrigin = parseTrustedIframeHostOrigin(
        new URL(window.location.href).searchParams.get(IFRAME_APP_HOST_ORIGIN_PARAM),
    );
    if (explicitOrigin) return explicitOrigin;

    return parseTrustedIframeHostOrigin(document.referrer);
}

/**
 * Ask an embedding Studio window for a fresh Vertesia token. Both sides validate the request nonce,
 * source window, and exact origin. The explicit host-origin parameter survives framed redirects and
 * hard navigations; referrer remains a compatibility fallback for older hosts.
 * Standalone/top-level apps return undefined and continue through the normal sign-in flow.
 */
export function requestIframeHostAuthToken(timeoutMs = 5000): Promise<string | undefined> {
    const parentOrigin = resolveIframeHostOrigin();
    if (!parentOrigin) return Promise.resolve(undefined);

    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
        let timeout: number;
        let retry: number;
        let retryDelay = 250;
        const finish = (token?: string) => {
            window.removeEventListener('message', onMessage);
            clearTimeout(timeout);
            clearTimeout(retry);
            resolve(token);
        };
        const onMessage = (event: MessageEvent<unknown>) => {
            if (event.source !== window.parent || event.origin !== parentOrigin || !isIframeAuthResponse(event.data)) {
                return;
            }
            if (event.data.requestId === requestId && event.data.token) finish(event.data.token);
        };
        const request = { type: IFRAME_AUTH_REQUEST, requestId } satisfies IframeAuthRequest;
        const sendRequest = () => {
            window.parent.postMessage(request, parentOrigin);
            retry = window.setTimeout(sendRequest, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 1000);
        };
        timeout = window.setTimeout(() => finish(), timeoutMs);
        window.addEventListener('message', onMessage);
        sendRequest();
    });
}
