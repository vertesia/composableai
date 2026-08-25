export const IFRAME_AUTH_REQUEST = 'vertesia:iframe-auth-request';
export const IFRAME_AUTH_RESPONSE = 'vertesia:iframe-auth-response';
export const IFRAME_APP_SLOT_PARAM = '__vertesia_slot';
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

/**
 * Ask an embedding Studio window for its current Vertesia token. The parent origin comes from the
 * iframe referrer and both sides validate the request nonce, source window, and exact origin.
 * Standalone/top-level apps return undefined and continue through the normal sign-in flow.
 */
export function requestIframeHostAuthToken(timeoutMs = 5000): Promise<string | undefined> {
    if (window.parent === window || !document.referrer) return Promise.resolve(undefined);

    let parentOrigin: string;
    try {
        parentOrigin = new URL(document.referrer).origin;
    } catch {
        return Promise.resolve(undefined);
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
        let timeout: number;
        let retry: number;
        const finish = (token?: string) => {
            window.removeEventListener('message', onMessage);
            clearTimeout(timeout);
            clearInterval(retry);
            resolve(token);
        };
        const onMessage = (event: MessageEvent<unknown>) => {
            if (event.source !== window.parent || event.origin !== parentOrigin || !isIframeAuthResponse(event.data)) {
                return;
            }
            if (event.data.requestId === requestId) finish(event.data.token);
        };
        const request = { type: IFRAME_AUTH_REQUEST, requestId } satisfies IframeAuthRequest;
        const sendRequest = () => window.parent.postMessage(request, parentOrigin);
        timeout = window.setTimeout(() => finish(), timeoutMs);
        retry = window.setInterval(sendRequest, 250);
        window.addEventListener('message', onMessage);
        sendRequest();
    });
}
