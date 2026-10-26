import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY, resolveLanguage, SUPPORTED_LANGUAGES } from '../i18n/rtl.js';
import {
    BOOT_SCREEN_STYLES,
    type BootScreenOptions,
    createBootScreenVitePlugin,
    injectBootScreenHtml,
    renderBootScreenHead,
    renderBootScreenRuntime,
    renderDefaultBootContent,
} from './index.js';
import { BOOT_TEXT } from './text.js';

interface BootScreenApi {
    language: string;
    direction: 'ltr' | 'rtl';
    ensureLoadingIndicator: () => void;
    hideLoadingIndicatorOnFirstRender: () => void;
    scheduleSlowLoadingNotice: () => void;
    hideLoadingIndicator: () => void;
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
    document.getElementById('loading-indicator')?.remove();
    vi.useRealTimers();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    document.body.innerHTML = '';
    document.title = '';
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
        const content = document.createElement('div');
        content.innerHTML = renderDefaultBootContent();
        expect(content.querySelector('.vboot-spinner')?.getAttribute('width')).toBe('40');
        expect(content.querySelector('.vboot-spinner')?.getAttribute('height')).toBe('40');
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

    it('handles tag and attribute casing without regular expressions', () => {
        const html = injectBootScreenHtml(
            '<!doctype html><HTML><HEAD><META CHARSET = "UTF-8"><script src="handler.js"></script></HEAD><BODY></BODY></HTML>',
        );

        expect(html.indexOf('<META CHARSET = "UTF-8">')).toBeLessThan(html.indexOf('id="vertesia-boot-styles"'));
        expect(html.indexOf('id="vertesia-boot-styles"')).toBeLessThan(html.indexOf('src="handler.js"'));
        expect(html.indexOf('window.__vertesiaBoot.ensureLoadingIndicator()')).toBeLessThan(html.indexOf('</BODY>'));
    });

    it('scans repeated malformed tag prefixes in linear time', () => {
        const malformedPrefixes = '<metadata>'.repeat(10_000);
        const html = `<!doctype html><html><head>${malformedPrefixes}<script src="handler.js"></script></head><body></body></html>`;

        const injected = injectBootScreenHtml(html);

        expect(injected.indexOf('id="vertesia-boot-styles"')).toBeLessThan(injected.indexOf(malformedPrefixes));
        expect(injected).toContain('window.__vertesiaBoot.ensureLoadingIndicator()');
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

        const loadingIndicator = document.getElementById('loading-indicator');
        expect(loadingIndicator).not.toBeNull();
        expect(loadingIndicator?.parentElement).toBe(document.documentElement);
        document.getElementById('root')?.append(document.createElement('main'));
        await vi.waitFor(() => expect(document.getElementById('loading-indicator')?.style.display).toBe('none'));

        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.style.backgroundColor).toBe('');
        expect(document.documentElement.style.colorScheme).toBe('');
    });
});

describe('custom boot branding', () => {
    it('copies the document title as text into app-owned title elements', () => {
        document.title = '<My application>';
        new Function(renderBootScreenRuntime({ html: '<h1 data-boot-title>Welcome</h1>' }))();
        bootApi().ensureLoadingIndicator();
        expect(document.querySelector('[data-boot-title]')?.textContent).toBe('<My application>');
        expect(document.querySelector('[data-boot-title]')?.children.length).toBe(0);
    });

    it('renders app HTML without the default spinner and hands off even when React already rendered', () => {
        document.body.innerHTML = '<div id="root"><main>React application</main></div>';
        new Function(renderBootScreenRuntime({ html: '<section>My custom brand</section>' }))();
        bootApi().ensureLoadingIndicator();
        const loader = document.getElementById('loading-indicator');
        expect(loader?.parentElement).toBe(document.body);
        expect(loader?.textContent).toBe('My custom brand');
        expect(loader?.querySelector('.vboot-spinner')).toBeNull();
        bootApi().hideLoadingIndicatorOnFirstRender();
        expect(loader?.style.display).toBe('none');
        expect(document.getElementById('root')?.textContent).toBe('React application');
    });

    it('escapes script terminators in trusted HTML while preserving the supplied content', () => {
        const html = '<p>Brand</p><!-- </script><script>unexpected()</script> -->';
        const runtime = renderBootScreenRuntime({ html });
        expect(runtime).not.toContain('</script>');
        new Function(runtime)();
        bootApi().ensureLoadingIndicator();
        expect(document.getElementById('loading-indicator')?.innerHTML).toBe(html);
    });

    it('inlines app styles after the defaults and respects a custom document background', () => {
        const styles = ':root { --vertesia-boot-background: rgb(12, 34, 56); }';
        const html = renderBootScreenHead({ styles });
        expect(html.indexOf(styles)).toBeGreaterThan(html.indexOf(BOOT_SCREEN_STYLES));
        document.documentElement.style.setProperty('--vertesia-boot-background', 'rgb(12, 34, 56)');
        runRuntime();
        expect(document.documentElement.style.backgroundColor).toBe('rgb(12, 34, 56)');
    });

    it('reveals app-owned slow-load recovery and cancels timers on handoff', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="root"></div>';
        new Function(
            renderBootScreenRuntime({
                html: `
            <p>Branded startup</p>
            <div id="loading-slow-notice" style="display:none">Taking longer
                <div id="loading-slow-reload" style="display:none"><button data-boot-reload>Reload</button></div>
            </div>`,
            }),
        )();
        bootApi().ensureLoadingIndicator();
        bootApi().hideLoadingIndicatorOnFirstRender();
        bootApi().scheduleSlowLoadingNotice();
        await vi.advanceTimersByTimeAsync(10000);
        expect(document.getElementById('loading-slow-notice')?.style.display).toBe('');
        expect(document.getElementById('loading-slow-reload')?.style.display).toBe('none');
        await vi.advanceTimersByTimeAsync(20000);
        expect(document.getElementById('loading-slow-reload')?.style.display).toBe('');
        document.getElementById('root')?.append(document.createElement('main'));
        await Promise.resolve();
        expect(document.getElementById('loading-indicator')?.style.display).toBe('none');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels pending slow-load notices when React renders promptly', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="root"></div>';
        runRuntime();
        bootApi().ensureLoadingIndicator();
        bootApi().hideLoadingIndicatorOnFirstRender();
        bootApi().scheduleSlowLoadingNotice();
        document.getElementById('root')?.append(document.createElement('main'));
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(0);
        expect(document.getElementById('loading-slow-notice')?.style.display).toBe('none');
    });
});

describe('boot screen language', () => {
    function showLoader(options: BootScreenOptions = {}) {
        new Function(renderBootScreenRuntime(options))();
        bootApi().ensureLoadingIndicator();
        const loader = document.getElementById('loading-indicator');
        return {
            loader,
            slowNotice: loader?.querySelector('[data-boot-text="slowLoading"]')?.textContent,
            reload: loader?.querySelector('[data-boot-text="reload"]')?.textContent,
            alt: loader?.querySelector('.vboot-spinner')?.getAttribute('alt'),
        };
    }

    function browserLanguage(language: string) {
        vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
    }

    it('follows the browser language when no language was saved', () => {
        browserLanguage('ja-JP');
        const { loader, slowNotice, reload, alt } = showLoader();

        expect(bootApi().language).toBe('ja');
        expect(loader?.lang).toBe('ja');
        expect(slowNotice).toBe(BOOT_TEXT.ja.slowLoading);
        expect(reload).toBe(BOOT_TEXT.ja.reload);
        expect(alt).toBe(BOOT_TEXT.ja.loading);
    });

    it('prefers the language LanguageProvider saved over the browser language', () => {
        browserLanguage('ja-JP');
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');

        expect(showLoader().slowNotice).toBe(BOOT_TEXT.fr.slowLoading);
    });

    it.each([
        ['pt-BR', 'pt'],
        ['zh-TW', 'zh-TW'],
        ['nl-NL', 'en'],
    ])('resolves %s to %s like resolveLanguage', (raw, expected) => {
        browserLanguage(raw);
        showLoader();

        expect(bootApi().language).toBe(expected);
        expect(bootApi().language).toBe(resolveLanguage(raw));
    });

    it('lays out right-to-left languages right to left', () => {
        browserLanguage('ar-EG');
        const { loader } = showLoader();

        expect(bootApi().direction).toBe('rtl');
        expect(loader?.dir).toBe('rtl');
    });

    it('keeps a pinned language whatever the browser and storage say', () => {
        browserLanguage('ja-JP');
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
        const { slowNotice } = showLoader({ language: 'en' });

        expect(bootApi().language).toBe('en');
        expect(slowNotice).toBe(BOOT_TEXT.en.slowLoading);
    });

    it('inlines only the pinned language', () => {
        const runtime = renderBootScreenRuntime({ language: 'en' });

        expect(runtime).toContain(BOOT_TEXT.en.slowLoading);
        expect(runtime).not.toContain(BOOT_TEXT.ja.slowLoading);
    });

    it('lets an app-supplied label win in every language', () => {
        browserLanguage('ja-JP');
        const { slowNotice, reload } = showLoader({ slowLoadingLabel: 'Warming up', reloadLabel: 'Refresh' });

        expect(slowNotice).toBe('Warming up');
        expect(reload).toBe('Refresh');
    });

    it('keeps branded labels and the dark icon when injected through the Vite plugin', () => {
        const html = createBootScreenVitePlugin({
            darkIconSrc: '/dark-icon.svg',
            slowLoadingLabel: 'Warming up',
            language: 'en',
        }).transformIndexHtml('<html><head><meta charset="UTF-8"></head><body></body></html>');

        expect(html).toContain('/dark-icon.svg');
        expect(html).toContain('Warming up');
    });

    it('has every boot string in every supported language', () => {
        for (const language of SUPPORTED_LANGUAGES) {
            expect(Object.values(BOOT_TEXT[language]).every((value) => value.trim() !== '')).toBe(true);
        }
    });
});
