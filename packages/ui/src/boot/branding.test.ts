import { describe, expect, it } from 'vitest';
import { brandedBootOptions, renderBrandStyles } from './branding.js';
import { injectBootScreenHtml } from './index.js';

describe('shared app branding', () => {
    it('escapes brand copy and logos in first paint and keeps recovery controls', () => {
        const options = brandedBootOptions({
            name: '<script>alert(1)</script>',
            logo: { light: 'logo.svg" onerror="bad' },
            copy: { loading: 'A & B' },
        });
        const root = document.createElement('div');
        root.innerHTML = options.html;
        expect(root.querySelector('script')).toBeNull();
        expect(root.querySelector('img')?.getAttribute('onerror')).toBeNull();
        expect(root.querySelector('h1')?.textContent).toBe('<script>alert(1)</script>');
        expect(root.querySelector('[data-boot-reload]')).toBeTruthy();
        expect(root.querySelector('#loading-slow-reload')?.getAttribute('style')).toBe('display:none');
        const html = injectBootScreenHtml('<html><head></head><body><div id="root"></div></body></html>', options);
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('scopes React colors and keeps decorative accents separate from button text', () => {
        const css = renderBrandStyles(
            { name: 'Test', colors: { light: { accent: '#ff6200' }, dark: { background: '#161d26' } } },
            '[data-vbrand="one"]',
        );
        expect(css).toContain('[data-vbrand="one"] {');
        expect(css).toContain('--brand-buttonText:#fff');
        expect(css).toContain('--brand-accent:#ff6200');
        expect(css).toContain('--color-background:var(--background)');
        expect(css).toContain('prefers-reduced-motion');
        expect(css).not.toContain('.vbrand {');
    });

    it('rejects CSS declaration injection and escapes font names', () => {
        expect(() =>
            renderBrandStyles({ name: 'Test', colors: { light: { background: 'red;}body{display:none' } } }),
        ).toThrow('Invalid branding color');
        const css = renderBrandStyles({ name: 'Test', font: { family: '</style>', regular: 'font.woff2' } });
        expect(css).not.toContain('</style>');
    });
});
