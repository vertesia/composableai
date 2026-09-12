/** Data-only branding shared by the build-time boot screen and the React shell. */
export interface AppBranding {
    name: string;
    title?: string;
    logo?: { light: string; dark?: string; alt?: string };
    favicon?: string;
    /** Small icon used by the existing loading layouts. */
    loadingIcon?: { light: string; dark?: string };
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

function colorDeclarations(colors?: BrandColors): string {
    const variables: Record<keyof BrandColors, string[]> = {
        background: ['--background', '--color-background', '--vb-bg'],
        foreground: ['--foreground', '--color-foreground', '--vb-fg'],
        accent: ['--info', '--info-foreground', '--color-info', '--color-info-foreground'],
        button: ['--primary', '--color-primary', '--vb-primary', '--auth-button'],
        buttonText: ['--primary-foreground', '--color-primary-foreground', '--vb-primary-fg', '--auth-button-text'],
    };
    return Object.entries(colors ?? {})
        .map(([key, value]) => {
            if (!Object.hasOwn(variables, key) || /[;{}<>]/.test(value))
                throw new Error(`Invalid branding color: ${key}`);
            return variables[key as keyof BrandColors].map((name) => `${name}:${value};`).join('');
        })
        .join('');
}

/** Theme tokens only: branding must never replace the shared page layout. */
export function renderBrandStyles(brand: AppBranding, selector = '.vbrand'): string {
    const font = brand.font;
    const faces = font
        ? `@font-face { font-family:${cssString(font.family)};src:url(${cssString(font.regular)});font-weight:400;font-display:swap; }
${font.bold ? `@font-face { font-family:${cssString(font.family)};src:url(${cssString(font.bold)});font-weight:700;font-display:swap; }` : ''}`
        : '';
    return `${faces}
${selector} { ${colorDeclarations(brand.colors?.light)}${font ? `font-family:${cssString(font.family)};` : ''} }
.dark ${selector},${selector}.vboot-dark { ${colorDeclarations(brand.colors?.dark)} }
`;
}

export function brandedBootOptions(brand: AppBranding): import('./index.js').BootScreenOptions {
    return {
        iconSrc: brand.loadingIcon?.light,
        darkIconSrc: brand.loadingIcon?.dark,
        loadingLabel: brand.copy?.loading,
        slowLoadingLabel: brand.copy?.slowLoading,
        reloadLabel: brand.copy?.reload,
        html: brand.boot?.html,
        styles: `${renderBrandStyles(brand, '#loading-indicator')}
${brand.colors?.light?.background ? `:root{--vertesia-boot-background:${brand.colors.light.background}}` : ''}
${brand.colors?.dark?.background ? `:root.dark{--vertesia-boot-background:${brand.colors.dark.background}}` : ''}
${brand.boot?.styles ?? ''}`,
    };
}
