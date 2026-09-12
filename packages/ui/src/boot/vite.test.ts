// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppBrandingPlugin, resolveBrandingAssets } from './vite.js';

const directories: string[] = [];
function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'ui-branding-'));
    directories.push(dir);
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(join(dir, 'assets/font.woff2'), 'font-bytes');
    return { dir, moduleUrl: pathToFileURL(join(dir, 'index.ts')) };
}
afterEach(() => {
    for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('branding Vite adapter', () => {
    it('resolves local assets once for both React and first paint independently of deployment paths', () => {
        const { moduleUrl } = fixture();
        const plugin = createAppBrandingPlugin(
            {
                name: 'A & B',
                logo: { light: './assets/logo.svg' },
                loadingIcon: { light: './assets/logo.svg', dark: './assets/logo.svg', animation: 'none' },
                font: { family: 'Brand', regular: './assets/font.woff2' },
                favicon: './assets/logo.svg',
            },
            moduleUrl,
        );
        const addWatchFile = vi.fn();
        const id = plugin.resolveId('virtual:vertesia-branding') ?? '';
        const code = plugin.load.call({ addWatchFile }, id) ?? '';
        const resolved = JSON.parse(code.slice('export default '.length, -1));
        expect(resolved.logo.light).toMatch(/^data:image\/svg\+xml;base64,/);
        expect(resolved.loadingIcon).toEqual({
            light: resolved.logo.light,
            dark: resolved.logo.light,
            animation: 'none',
        });
        expect(resolved.font.regular).toBe('data:font/woff2;base64,Zm9udC1ieXRlcw==');
        expect(addWatchFile).toHaveBeenCalledTimes(2);
        const html = plugin.transformIndexHtml(
            '<html><head><title>Old</title><link rel="icon" href="old.ico"></head><body></body></html>',
        );
        expect(html).toContain('<title>A &amp; B</title>');
        expect(html).toContain(resolved.logo.light);
        expect(html).not.toContain('old.ico');
        expect(html).not.toContain('./assets/');
    });

    it('fails for missing assets and resolves custom boot assets relative to their own files', () => {
        const { moduleUrl, dir } = fixture();
        expect(() => resolveBrandingAssets({ name: 'Test', logo: { light: './missing.svg' } }, moduleUrl)).toThrow();
        writeFileSync(
            join(dir, 'assets/boot.html'),
            '<img src="logo.svg"><a href="./help">Help</a><svg><use href="#icon"/></svg>',
        );
        writeFileSync(join(dir, 'assets/boot.css'), '@font-face{src:url(font.woff2)}');
        const brand = resolveBrandingAssets(
            { name: 'Test', boot: { html: './assets/boot.html', styles: './assets/boot.css' } },
            moduleUrl,
        );
        expect(brand.boot?.html).toContain('data:image/svg+xml;base64,');
        expect(brand.boot?.styles).toContain('data:font/woff2;base64,');
        expect(brand.boot?.html).toContain('<a href="./help">Help</a>');
        expect(brand.boot?.html).toContain('href="#icon"');
    });

    it('refreshes the virtual module when a watched logo changes', () => {
        const { moduleUrl, dir } = fixture();
        const plugin = createAppBrandingPlugin({ name: 'Test', logo: { light: './assets/logo.svg' } }, moduleUrl);
        const id = plugin.resolveId('virtual:vertesia-branding') ?? '';
        plugin.load.call({ addWatchFile: vi.fn() }, id);
        const module = {};
        const invalidateModule = vi.fn();
        const send = vi.fn();
        plugin.handleHotUpdate({
            file: join(dir, 'assets/logo.svg'),
            server: { moduleGraph: { getModuleById: () => module, invalidateModule }, ws: { send } },
        });
        expect(invalidateModule).toHaveBeenCalledWith(module);
        expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
        writeFileSync(join(dir, 'assets/logo.svg'), '<svg>changed</svg>');
        expect(plugin.load.call({ addWatchFile: vi.fn() }, id)).toContain(
            Buffer.from('<svg>changed</svg>').toString('base64'),
        );
    });
});
