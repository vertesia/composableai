import { describe, expect, it } from 'vitest';
import { brandedBootOptions, renderBrandStyles } from './branding.js';
import { injectBootScreenHtml, renderDefaultBootContent } from './index.js';

describe('shared app branding', () => {
    it('escapes brand copy and logos in first paint and keeps recovery controls', () => {
        const options = brandedBootOptions({
            name: '<script>alert(1)</script>',
            loadingIcon: { light: 'logo.svg" onerror="bad' },
            copy: { loading: 'A & B' },
        });
        const root = document.createElement('div');
        root.innerHTML = renderDefaultBootContent(options);
        expect(root.querySelector('script')).toBeNull();
        expect(root.querySelector('img')?.getAttribute('onerror')).toBeNull();
        expect(root.querySelector('h1')).toBeNull();
        expect(root.querySelector('[data-boot-reload]')?.className).toBe('vboot-btn');
        expect(root.querySelector('#loading-slow-notice')?.className).toBe('vboot-slow');
        expect(root.querySelector('#loading-slow-notice p')).toBeTruthy();
        expect(root.querySelector<HTMLElement>('#loading-slow-reload')?.style.display).toBe('none');
        const html = injectBootScreenHtml('<html><head></head><body><div id="root"></div></body></html>', options);
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('scopes React colors and keeps decorative accents separate from button text', () => {
        const css = renderBrandStyles(
            { name: 'Test', colors: { light: { accent: '#ff6200' }, dark: { background: '#161d26' } } },
            '[data-vbrand="one"]',
        );
        expect(css).toContain('[data-vbrand="one"] {');
        expect(css).not.toContain('display:');
        expect(css).not.toContain('padding:');
        expect(css).toContain('--info:#ff6200');
        expect(css).toContain('--color-background:#161d26');
        expect(renderDefaultBootContent(brandedBootOptions({ name: 'Test' }))).toBe(renderDefaultBootContent());
        expect(css).not.toContain('.vbrand {');
    });

    it('shares custom animation and keyframes between React and boot, and supports static logos', () => {
        const brand = {
            name: 'Test',
            loadingIcon: {
                light: 'icon.svg',
                animation: 'example-dim 2s ease-in-out infinite',
                keyframes: '@keyframes example-dim { 50% { opacity: 0.35; } }',
            },
        };
        for (const css of [renderBrandStyles(brand), brandedBootOptions(brand).styles]) {
            expect(css).toContain('--vertesia-loading-animation:example-dim 2s ease-in-out infinite;');
            expect(css).toContain('--vertesia-loading-pulse-animation:none;');
            expect(css).toContain(brand.loadingIcon.keyframes);
        }
        expect(renderBrandStyles({ name: 'Default' })).not.toContain('--vertesia-loading-animation:');
        expect(renderBrandStyles({ ...brand, loadingIcon: { light: 'icon.svg', animation: 'none' } })).toContain(
            '--vertesia-loading-animation:none;',
        );
        expect(() =>
            renderBrandStyles({ ...brand, loadingIcon: { light: 'icon.svg', animation: 'none;}body{}' } }),
        ).toThrow('Invalid loading icon animation');
        expect(() =>
            renderBrandStyles({ ...brand, loadingIcon: { light: 'icon.svg', keyframes: '</style>' } }),
        ).toThrow('Invalid loading icon keyframes');
    });

    it('rejects CSS declaration injection and escapes font names', () => {
        expect(() =>
            renderBrandStyles({ name: 'Test', colors: { light: { background: 'red;}body{display:none' } } }),
        ).toThrow('Invalid branding color');
        const css = renderBrandStyles({ name: 'Test', font: { family: '</style>', regular: 'font.woff2' } });
        expect(css).not.toContain('</style>');
    });
});
