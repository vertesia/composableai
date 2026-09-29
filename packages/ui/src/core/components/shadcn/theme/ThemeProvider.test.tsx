// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider.js';

let dark = false;
let media: EventTarget;

beforeEach(() => {
    dark = false;
    media = new EventTarget();
    vi.stubGlobal('matchMedia', () => ({
        get matches() {
            return dark;
        },
        addEventListener: media.addEventListener.bind(media),
        removeEventListener: media.removeEventListener.bind(media),
    }));
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    vi.unstubAllGlobals();
});

function systemTheme(isDark: boolean) {
    act(() => {
        dark = isDark;
        media.dispatchEvent(new Event('change'));
    });
}

function storedTheme(value: string | null, key: string | null = 'vite-ui-theme') {
    act(() => {
        const event = new StorageEvent('storage', { key, newValue: value });
        Object.defineProperty(event, 'storageArea', { value: localStorage });
        window.dispatchEvent(event);
    });
}

describe('ThemeProvider live preferences', () => {
    it('follows system changes while the authorization page remains open', () => {
        render(
            <ThemeProvider>
                <div />
            </ThemeProvider>,
        );
        expect(document.documentElement.classList.contains('light')).toBe(true);
        systemTheme(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        systemTheme(false);
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });

    it.each(['light', 'dark'])('keeps explicit %s preference over the system', (theme) => {
        localStorage.setItem('vite-ui-theme', theme);
        render(
            <ThemeProvider>
                <div />
            </ThemeProvider>,
        );
        systemTheme(true);
        systemTheme(false);
        expect(document.documentElement.classList.contains(theme)).toBe(true);
    });

    it('syncs another tab and resumes system tracking when the preference is cleared', () => {
        render(
            <ThemeProvider>
                <div />
            </ThemeProvider>,
        );
        storedTheme('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        systemTheme(false);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        storedTheme('light');
        expect(document.documentElement.classList.contains('light')).toBe(true);
        storedTheme('system');
        systemTheme(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        storedTheme('light');
        storedTheme(null, null);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        storedTheme('light', 'unrelated');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes system listeners when unmounted', () => {
        const { unmount } = render(
            <ThemeProvider>
                <div />
            </ThemeProvider>,
        );
        unmount();
        systemTheme(true);
        expect(document.documentElement.classList.contains('light')).toBe(true);
    });
});
