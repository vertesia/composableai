/** Data-only branding shared by the build-time boot screen and the React shell. */
export interface AppBranding {
    name: string;
    title?: string;
    logo?: { light: string; dark?: string; alt?: string };
    favicon?: string;
    font?: { family: string; regular: string; bold?: string };
    colors?: { light?: BrandColors; dark?: BrandColors };
    copy?: {
        welcome?: string;
        emailPlaceholder?: string;
        loading?: string;
        slowLoading?: string;
        reload?: string;
        footer?: string;
        /** Optional auth./signup. translation overrides, local to this shell. */
        translations?: Record<string, string>;
    };
    /** File paths in source configuration; trusted HTML/CSS content after build-time resolution. */
    boot?: { html?: string; styles?: string };
}

export interface BrandColors {
    background?: string;
    foreground?: string;
    /** Decorative accents, focus indicators, and spinners; never used as body text. */
    accent?: string;
    button?: string;
    buttonText?: string;
}

export function defineAppBranding(branding: AppBranding): AppBranding {
    return branding;
}

export function escapeBrandHtml(value: string): string {
    return value.replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
    );
}

function cssString(value: string): string {
    return JSON.stringify(value).replace(/</g, '\\3c ');
}

function colorDeclarations(colors: BrandColors = {}): string {
    return Object.entries(colors)
        .map(([key, value]) => {
            if (!/^(background|foreground|accent|button|buttonText)$/.test(key) || /[;{}<>]/.test(value)) {
                throw new Error(`Invalid branding color: ${key}`);
            }
            return `--brand-${key}:${value};`;
        })
        .join('');
}

/** Scoped CSS also works before Tailwind, React, or application styles have loaded. */
export function renderBrandStyles(brand: AppBranding, selector = '.vbrand'): string {
    const font = brand.font;
    const faces = font
        ? `
@font-face { font-family:${cssString(font.family)};src:url(${cssString(font.regular)});font-weight:400;font-display:swap; }
${font.bold ? `@font-face { font-family:${cssString(font.family)};src:url(${cssString(font.bold)});font-weight:700;font-display:swap; }` : ''}`
        : '';
    return `${faces}
.vbrand { --brand-background:#fff;--brand-foreground:#0a0a0a;--brand-accent:#0048bd;--brand-button:#0a0a0a;--brand-buttonText:#fff;${colorDeclarations(brand.colors?.light)} }
.dark .vbrand,.vbrand.vboot-dark { --brand-background:#0a0a0a;--brand-foreground:#fafafa;--brand-accent:#2b69d1;--brand-button:#fafafa;--brand-buttonText:#0a0a0a;${colorDeclarations(brand.colors?.dark)} }
.vbrand {
 --background:var(--brand-background);--foreground:var(--brand-foreground);
 --primary:var(--brand-button);--primary-foreground:var(--brand-buttonText);
 --color-background:var(--background);--color-foreground:var(--foreground);
 --color-primary:var(--primary);--color-primary-foreground:var(--primary-foreground);
 background:var(--brand-background);color:var(--brand-foreground);
 font-family:${font ? cssString(font.family) : 'inherit'};
 box-sizing:border-box;width:100%;min-width:0;min-height:100dvh;padding:3rem 1.5rem;
 display:flex;align-items:center;justify-content:center;
}
.vbrand-panel { width:100%;max-width:32rem;display:flex;flex-direction:column;align-items:center;gap:1.5rem; }
.vbrand-heading { margin:0;font-size:1.5rem;font-weight:600;text-align:center; }
.vbrand-logo { width:180px;height:72px;object-fit:contain; }
.vbrand-logo-dark { display:none; }
.dark .vbrand-logo-light,.vboot-dark .vbrand-logo-light { display:none; }
.dark .vbrand-logo-dark,.vboot-dark .vbrand-logo-dark { display:block; }
.vbrand-status { text-align:center; }
.vbrand input:focus { border-color:var(--brand-accent);--tw-ring-color:var(--brand-accent); }
.vbrand-spinner { width:2rem;height:2rem;border:3px solid color-mix(in srgb,var(--brand-foreground) 15%,transparent);border-block-start-color:var(--brand-accent);border-radius:50%;animation:vbrand-spin 1s linear infinite; }
.vbrand .vboot-btn { background:var(--brand-button);color:var(--brand-buttonText); }
.vbrand .vboot-btn:focus-visible { outline:2px solid var(--brand-accent);outline-offset:3px; }
@keyframes vbrand-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .vbrand-spinner { animation:none; } }
`.replace(/\.vbrand(?![\w-])/g, selector);
}

export function renderBrandLogo(brand: AppBranding): string {
    if (!brand.logo) return '';
    const alt = escapeBrandHtml(brand.logo.alt ?? brand.name);
    return `<img class="vbrand-logo vbrand-logo-light" src="${escapeBrandHtml(brand.logo.light)}" alt="${alt}"><img class="vbrand-logo vbrand-logo-dark" src="${escapeBrandHtml(brand.logo.dark ?? brand.logo.light)}" alt="${alt}">`;
}

export function brandedBootOptions(brand: AppBranding) {
    return {
        html:
            brand.boot?.html ??
            `<main class="vbrand"><div class="vbrand-panel" role="status" aria-live="polite">
${renderBrandLogo(brand)}<h1 class="vbrand-heading">${escapeBrandHtml(brand.name)}</h1>
<span class="vbrand-spinner" aria-hidden="true"></span><p>${escapeBrandHtml(brand.copy?.loading ?? 'Loading your workspace…')}</p>
<div id="loading-slow-notice" class="vboot-slow" style="display:none"><p>${escapeBrandHtml(brand.copy?.slowLoading ?? 'This is taking longer than usual.')}</p>
<div id="loading-slow-reload" style="display:none"><button type="button" class="vboot-btn" data-boot-reload>${escapeBrandHtml(brand.copy?.reload ?? 'Reload page')}</button></div></div>
</div></main>`,
        styles: `${renderBrandStyles(brand)}\n:root{--vertesia-boot-background:${brand.colors?.light?.background ?? '#fff'}}:root.dark{--vertesia-boot-background:${brand.colors?.dark?.background ?? '#0a0a0a'}}\n${brand.boot?.styles ?? ''}`,
    };
}
