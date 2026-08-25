// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../core/index.js';
import { LanguageProvider, useLanguage } from '../../i18n/index.js';
import { IframeAppContextSync } from './IframeAppContextSync.js';
import { IFRAME_APP_CONTEXT, IFRAME_APP_CONTEXT_REQUEST } from './iframe-auth.js';

const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
const originalReferrer = Object.getOwnPropertyDescriptor(document, 'referrer');

afterEach(() => {
    localStorage.clear();
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
        const parentWindow = { postMessage: vi.fn() } as unknown as Window;
        Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://studio.example.com/app/sample',
        });
        localStorage.setItem('vite-ui-theme', 'dark');
        localStorage.setItem('vertesia-ui-language', 'en');

        render(
            <ThemeProvider>
                <LanguageProvider>
                    <IframeAppContextSync />
                    <ContextProbe />
                </LanguageProvider>
            </ThemeProvider>,
        );

        expect(parentWindow.postMessage).toHaveBeenCalledWith(
            { type: IFRAME_APP_CONTEXT_REQUEST },
            'https://studio.example.com',
        );

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_CONTEXT, theme: 'light', language: 'fr' },
                origin: 'https://attacker.example.com',
                source: parentWindow,
            }),
        );
        expect(screen.getByText('dark:en')).toBeTruthy();

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: IFRAME_APP_CONTEXT, theme: 'light', language: 'fr' },
                origin: 'https://studio.example.com',
                source: parentWindow,
            }),
        );

        await waitFor(() => expect(screen.getByText('light:fr')).toBeTruthy());
        expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
        expect(localStorage.getItem('vertesia-ui-language')).toBe('en');
    });
});
