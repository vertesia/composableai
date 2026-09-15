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
    it('resolves an explicit trusted host origin', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fcloud.vertesia.io`);

        expect(resolveIframeHostOrigin()).toBe('https://cloud.vertesia.io');
    });

    it('accepts a branch Studio UI origin', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(
            null,
            '',
            `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fdev-feat-iframe.ui.dev1.vertesia.io`,
        );

        expect(resolveIframeHostOrigin()).toBe('https://dev-feat-iframe.ui.dev1.vertesia.io');
    });

    it('rejects untrusted query and referrer origins', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fevil.example.com`);
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://referrer.example.com/embed',
        });

        expect(resolveIframeHostOrigin()).toBeUndefined();
    });

    it('rejects a shared Vertesia app-gateway origin', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fapps.dev1.vertesia.io`);

        expect(resolveIframeHostOrigin()).toBeUndefined();
    });

    it('rejects an origin containing embedded credentials', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(
            null,
            '',
            `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fuser%3Asecret%40cloud.vertesia.io`,
        );

        expect(resolveIframeHostOrigin()).toBeUndefined();
    });

    it('accepts a loopback host for a loopback child app', () => {
        const parentWindow = { postMessage: () => undefined } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=http%3A%2F%2Flocalhost%3A5173`);

        expect(resolveIframeHostOrigin()).toBe('http://localhost:5173');
    });

    it('ignores an empty early response and waits for a usable host token', async () => {
        const requests: unknown[] = [];
        const parentWindow = { postMessage: (message: unknown) => requests.push(message) } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fcloud.vertesia.io`);

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
                origin: 'https://cloud.vertesia.io',
                source: parentWindow,
            }),
        );
        await Promise.resolve();
        expect(settled).toBe(false);

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_AUTH_RESPONSE, requestId: request.requestId, token: 'fresh-token' },
                origin: 'https://cloud.vertesia.io',
                source: parentWindow,
            }),
        );
        await expect(tokenPromise).resolves.toBe('fresh-token');
    });
});
