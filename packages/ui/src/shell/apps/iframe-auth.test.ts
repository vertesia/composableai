// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
    IFRAME_APP_HOST_ORIGIN_PARAM,
    IFRAME_AUTH_REQUEST,
    IFRAME_AUTH_RESPONSE,
    requestIframeHostAuthToken,
    resolveIframeHostOrigin,
} from './iframe-auth.js';

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
const originalReferrer = Object.getOwnPropertyDescriptor(document, 'referrer');

afterEach(() => {
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    else Reflect.deleteProperty(window, 'parent');
    if (originalReferrer) Object.defineProperty(document, 'referrer', originalReferrer);
    else Reflect.deleteProperty(document, 'referrer');
});

describe('iframe host authentication', () => {
    it('persists an explicit HTTP host origin across hard-navigation URL changes', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fstudio.example.com`);

        expect(resolveIframeHostOrigin()).toBe('https://studio.example.com');

        window.history.replaceState(null, '', '/after-auth');
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://apps.example.com/before-auth',
        });
        expect(resolveIframeHostOrigin()).toBe('https://studio.example.com');
    });

    it('ignores an empty early response and waits for a usable host token', async () => {
        const requests: unknown[] = [];
        const parentWindow = { postMessage: (message: unknown) => requests.push(message) } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fstudio.example.com`);

        let settled = false;
        const tokenPromise = requestIframeHostAuthToken().then((token) => {
            settled = true;
            return token;
        });
        const request = requests[0] as { type: string; requestId: string };
        expect(request.type).toBe(IFRAME_AUTH_REQUEST);

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_AUTH_RESPONSE, requestId: request.requestId },
                origin: 'https://studio.example.com',
                source: parentWindow,
            }),
        );
        await Promise.resolve();
        expect(settled).toBe(false);

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_AUTH_RESPONSE, requestId: request.requestId, token: 'fresh-token' },
                origin: 'https://studio.example.com',
                source: parentWindow,
            }),
        );
        await expect(tokenPromise).resolves.toBe('fresh-token');
    });
});
