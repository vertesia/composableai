import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BOOT_SCREEN_STYLES,
    createBootScreenVitePlugin,
    injectBootScreenHtml,
    renderBootScreenHead,
    renderBootScreenRuntime,
} from './index.js';

interface BootScreenApi {
    ensureLoadingIndicator: () => void;
    hideLoadingIndicatorOnFirstRender: () => void;
}

function bootApi(): BootScreenApi {
    return (window as unknown as { __vertesiaBoot: BootScreenApi }).__vertesiaBoot;
}

function runRuntime({ dark = false, storageKey = 'test-theme' }: { dark?: boolean; storageKey?: string } = {}) {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => ({ matches: dark })),
    });
    new Function(renderBootScreenRuntime({ storageKey }))();
}

afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('boot screen HTML integration', () => {
    it('injects the shared styles and runtime before app assets', () => {
        const plugin = createBootScreenVitePlugin({ storageKey: 'auth-ui-theme', iconSrc: '/auth-icon.svg' });
        const html = plugin.transformIndexHtml(
            '<html><head><meta charset="UTF-8"><script src="/app.js"></script></head><body><div id="root"></div></body></html>',
        );

        expect(html.indexOf('<meta charset="UTF-8">')).toBeLessThan(html.indexOf('id="vertesia-boot-styles"'));
        expect(html.indexOf('id="vertesia-boot-styles"')).toBeLessThan(html.indexOf('src="/app.js"'));
        expect(html).toContain(BOOT_SCREEN_STYLES);
        expect(html).toContain('auth-ui-theme');
        expect(html).toContain('/auth-icon.svg');
        expect(html).toContain('class="vboot-spinner" width="40" height="40"');
        expect(html).toContain('window.__vertesiaBoot.hideLoadingIndicatorOnFirstRender()');
    });

    it('can render the same bootstrap into server-generated HTML', () => {
        const html = renderBootScreenHead({ storageKey: 'vite-ui-theme' });

        expect(html).toContain('id="vertesia-boot-styles"');
        expect(html).toContain('window.__vertesiaBoot');
        expect(html).toContain('vite-ui-theme');
    });

    it('injects the bootstrap before scripts in a document without a charset meta tag', () => {
        const html = injectBootScreenHtml(
            '<!doctype html><html><head><script src="handler.js"></script></head><body></body></html>',
            { storageKey: 'auth-ui-theme', iconSrc: '/auth-icon.svg' },
        );

        expect(html.indexOf('id="vertesia-boot-styles"')).toBeLessThan(html.indexOf('src="handler.js"'));
        expect(html).toContain('auth-ui-theme');
        expect(html).toContain('/auth-icon.svg');
        expect(html).toContain('window.__vertesiaBoot.ensureLoadingIndicator()');
    });
});

describe('boot screen runtime', () => {
    it('paints dark before React when the system prefers dark mode', () => {
        runRuntime({ dark: true });

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.style.backgroundColor).toBe('rgb(10, 10, 10)');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('lets an explicit stored theme override the system preference', () => {
        localStorage.setItem('test-theme', 'light');
        runRuntime({ dark: true });

        expect(document.documentElement.classList.contains('light')).toBe(true);
        expect(document.documentElement.style.backgroundColor).toBe('rgb(255, 255, 255)');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('shows the shared loader and hands the document back after the app renders', async () => {
        document.body.innerHTML = '<div id="root"></div>';
        runRuntime({ dark: true });
        bootApi().ensureLoadingIndicator();
        bootApi().hideLoadingIndicatorOnFirstRender();

        expect(document.getElementById('loading-indicator')).not.toBeNull();
        document.getElementById('root')?.append(document.createElement('main'));
        await vi.waitFor(() => expect(document.getElementById('loading-indicator')?.style.display).toBe('none'));

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.style.backgroundColor).toBe('');
        expect(document.documentElement.style.colorScheme).toBe('');
    });
});
