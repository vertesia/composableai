// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../core/index.js';
import { LanguageProvider, useLanguage } from '../../i18n/index.js';
import { IframeAppContextSync } from './IframeAppContextSync.js';
import {
    IFRAME_APP_CONTEXT,
    IFRAME_APP_CONTEXT_REQUEST,
    IFRAME_APP_HOST_ORIGIN_PARAM,
    IFRAME_APP_LOCATION_CHANGE,
    IFRAME_APP_NAVIGATE,
} from './iframe-auth.js';

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
const originalReferrer = Object.getOwnPropertyDescriptor(document, 'referrer');

afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    else Reflect.deleteProperty(window, 'parent');
    if (originalReferrer) Object.defineProperty(document, 'referrer', originalReferrer);
    else Reflect.deleteProperty(document, 'referrer');
});

function ContextProbe() {
    const { theme } = useTheme();
    const { language } = useLanguage();
    return <div>{`${theme}:${language}`}</div>;
}

describe('IframeAppContextSync', () => {
    it('requests and applies host presentation state without overwriting standalone preferences', async () => {
        const postMessage = vi.fn();
        const parentWindow = { postMessage } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://cloud.vertesia.io/app/sample',
        });
        localStorage.setItem('custom-theme', 'dark');
        localStorage.setItem('custom-language', 'en');

        render(
            <ThemeProvider storageKey="custom-theme">
                <LanguageProvider storageKey="custom-language">
                    <IframeAppContextSync />
                    <ContextProbe />
                </LanguageProvider>
            </ThemeProvider>,
        );

        expect(parentWindow.postMessage).toHaveBeenCalledWith(
            { type: IFRAME_APP_CONTEXT_REQUEST },
            'https://cloud.vertesia.io',
        );

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_CONTEXT, theme: 'light', language: 'fr' },
                origin: 'https://attacker.example.com',
                source: parentWindow,
            }),
        );
        expect(screen.getByText('dark:en')).toBeTruthy();

        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: { type: IFRAME_APP_CONTEXT, theme: 'light', language: 'fr' },
                    origin: 'https://cloud.vertesia.io',
                    source: parentWindow,
                }),
            );
        });

        await waitFor(() => expect(screen.getByText('light:fr')).toBeTruthy());
        expect(localStorage.getItem('custom-theme')).toBe('dark');
        expect(localStorage.getItem('custom-language')).toBe('en');
        expect(postMessage.mock.calls.filter(([message]) => message.type === IFRAME_APP_CONTEXT_REQUEST)).toHaveLength(
            1,
        );
    });

    it('applies same-origin host navigation without reloading the document', () => {
        const parentWindow = { postMessage: vi.fn() } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://cloud.vertesia.io/app/sample',
        });
        localStorage.setItem('vite-ui-theme', 'dark');
        localStorage.setItem('vertesia-ui-language', 'en');
        window.history.replaceState(null, '', '/app/');
        const popstate = vi.fn();
        window.addEventListener('popstate', popstate);

        render(
            <ThemeProvider>
                <LanguageProvider>
                    <IframeAppContextSync />
                </LanguageProvider>
            </ThemeProvider>,
        );

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_NAVIGATE, url: 'https://attacker.example.com/stolen' },
                origin: 'https://cloud.vertesia.io',
                source: parentWindow,
            }),
        );
        expect(window.location.pathname).toBe('/app/');

        const target = `${window.location.origin}/app/reports?__vertesia_slot=content`;
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_NAVIGATE, url: target },
                origin: 'https://cloud.vertesia.io',
                source: parentWindow,
            }),
        );

        expect(window.location.pathname).toBe('/app/reports');
        expect(window.location.search).toBe('?__vertesia_slot=content');
        expect(popstate).toHaveBeenCalledTimes(1);
        window.removeEventListener('popstate', popstate);
    });

    it('acknowledges host navigation when the iframe is already at the requested URL', () => {
        const parentWindow = { postMessage: vi.fn() } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        localStorage.setItem('vite-ui-theme', 'dark');
        window.history.replaceState(
            null,
            '',
            `/app/reports?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fcloud.vertesia.io`,
        );

        render(
            <ThemeProvider>
                <LanguageProvider>
                    <IframeAppContextSync />
                </LanguageProvider>
            </ThemeProvider>,
        );
        parentWindow.postMessage = vi.fn();

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_NAVIGATE, url: window.location.href },
                origin: 'https://cloud.vertesia.io',
                source: parentWindow,
            }),
        );

        expect(parentWindow.postMessage).toHaveBeenCalledWith(
            { type: IFRAME_APP_LOCATION_CHANGE, url: window.location.href },
            'https://cloud.vertesia.io',
        );
    });

    it('reports app-initiated history navigation to the embedding Studio', () => {
        const parentWindow = { postMessage: vi.fn() } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        window.history.replaceState(null, '', `/app/?${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fcloud.vertesia.io`);
        localStorage.setItem('vite-ui-theme', 'dark');
        localStorage.setItem('vertesia-ui-language', 'en');

        render(
            <ThemeProvider>
                <LanguageProvider>
                    <IframeAppContextSync />
                </LanguageProvider>
            </ThemeProvider>,
        );
        parentWindow.postMessage = vi.fn();

        window.history.pushState(null, '', '/app/reports?period=week');

        expect(parentWindow.postMessage).toHaveBeenCalledWith(
            {
                type: IFRAME_APP_LOCATION_CHANGE,
                url:
                    `${window.location.origin}/app/reports?period=week&` +
                    `${IFRAME_APP_HOST_ORIGIN_PARAM}=https%3A%2F%2Fcloud.vertesia.io`,
            },
            'https://cloud.vertesia.io',
        );
    });
});
