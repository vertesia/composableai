/** Node-only adapter. Import from @vertesia/ui/boot/vite, never from browser code. */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AppBranding, brandedBootOptions, escapeBrandHtml } from './branding.js';
import { injectBootScreenHtml } from './index.js';

const VIRTUAL_ID = 'virtual:vertesia-branding';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const MIME: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.otf': 'font/otf',
    '.ttf': 'font/ttf',
    '.avif': 'image/avif',
};

/** Inline local assets so React and pre-React markup work under any gateway base path. */
export function resolveBrandingAssets(branding: AppBranding, moduleUrl: URL, watch: (file: string) => void = () => {}) {
    function asset(value: string, base = moduleUrl): string {
        if (/^(https?:|data:|#)/i.test(value)) return value;
        const url = new URL(value, base);
        if (url.protocol !== 'file:') throw new Error(`Unsupported branding asset URL: ${value}`);
        const file = fileURLToPath(url);
        const mime = MIME[extname(file).toLowerCase()];
        if (!mime) throw new Error(`Unsupported branding asset type: ${file}`);
        watch(file);
        return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
    }
    function source(value: string, css: boolean): string {
        const url = new URL(value, moduleUrl);
        const file = fileURLToPath(url);
        watch(file);
        const text = readFileSync(file, 'utf8');
        return css
            ? text.replace(
                  /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g,
                  (_match, path: string) => `url("${asset(path, url)}")`,
              )
            : text.replace(
                  /(<(?:img|source|link)\b[^>]*?\s)(src|href)=["']([^"']+)["']/gi,
                  (_match, tag: string, attr: string, path: string) =>
                      `${tag}${attr}="${escapeBrandHtml(asset(path, url))}"`,
              );
    }
    return {
        ...branding,
        logo: branding.logo && {
            ...branding.logo,
            light: asset(branding.logo.light),
            dark: branding.logo.dark ? asset(branding.logo.dark) : undefined,
        },
        loadingIcon: branding.loadingIcon && {
            ...branding.loadingIcon,
            light: asset(branding.loadingIcon.light),
            dark: branding.loadingIcon.dark ? asset(branding.loadingIcon.dark) : undefined,
        },
        favicon: branding.favicon ? asset(branding.favicon) : undefined,
        font: branding.font && {
            ...branding.font,
            regular: asset(branding.font.regular),
            bold: branding.font.bold ? asset(branding.font.bold) : undefined,
        },
        boot: branding.boot && {
            html: branding.boot.html ? source(branding.boot.html, false) : undefined,
            styles: branding.boot.styles ? source(branding.boot.styles, true) : undefined,
        },
    } satisfies AppBranding;
}

export function createAppBrandingPlugin(branding: AppBranding, moduleUrl: URL) {
    const watched = new Set<string>();
    const resolve = () => resolveBrandingAssets(branding, moduleUrl, (file) => watched.add(file));
    return {
        name: 'vertesia-app-branding',
        resolveId(id: string) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;
        },
        load(this: { addWatchFile(file: string): void }, id: string) {
            if (id !== RESOLVED_ID) return;
            const resolved = resolve();
            for (const file of watched) this.addWatchFile(file);
            return `export default ${JSON.stringify(resolved)};`;
        },
        handleHotUpdate<Module>(context: {
            file: string;
            server: {
                moduleGraph: { getModuleById(id: string): Module | undefined; invalidateModule(module: Module): void };
                ws: { send(payload: { type: 'full-reload' }): void };
            };
        }) {
            if (!watched.has(context.file)) return;
            const module = context.server.moduleGraph.getModuleById(RESOLVED_ID);
            if (module) context.server.moduleGraph.invalidateModule(module);
            context.server.ws.send({ type: 'full-reload' });
            return [];
        },
        transformIndexHtml(html: string) {
            const resolved = resolve();
            const title = escapeBrandHtml(resolved.title ?? resolved.name);
            let result = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
            if (resolved.favicon) {
                result = result.replace(/<link\b(?=[^>]*\brel=["'](?:shortcut )?icon["'])[^>]*>/gi, '');
                result = result.replace(
                    '</head>',
                    `<link rel="icon" href="${escapeBrandHtml(resolved.favicon)}"></head>`,
                );
            }
            return injectBootScreenHtml(result, brandedBootOptions(resolved));
        },
    };
}
