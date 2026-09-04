export interface BootScreenOptions {
    storageKey?: string;
    iconSrc?: string;
    loadingLabel?: string;
    autoStart?: boolean;
}

export interface BootScreenHtmlPlugin {
    name: string;
    transformIndexHtml: (html: string) => string;
}

const DEFAULT_STORAGE_KEY = 'vite-ui-theme';
const DEFAULT_ICON_SRC = '/icon.svg';
const DEFAULT_LOADING_LABEL = 'Loading';

export const BOOT_SCREEN_STYLES = `
  .vboot {
    --vb-bg: #ffffff;
    --vb-fg: #0a0a0a;
    --vb-muted: #636363;
    --vb-muted-bg: #f5f5f5;
    --vb-border: #e5e5e5;
    --vb-primary: #0048bd;
    --vb-primary-fg: #ffffff;
    --vb-glow: rgba(50, 49, 189, 0.12);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: var(--vb-fg);
  }
  .vboot.vboot-dark {
    --vb-bg: #0a0a0a;
    --vb-fg: #fafafa;
    --vb-muted: #a1a1a1;
    --vb-muted-bg: #262626;
    --vb-border: rgba(255, 255, 255, 0.1);
    --vb-primary: #2b69d1;
    --vb-primary-fg: #fafafa;
    --vb-glow: rgba(79, 70, 229, 0.2);
  }
  @keyframes vboot-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .vboot-overlay {
    position: absolute !important;
    inset: 0 !important;
    box-sizing: border-box !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 1.5rem !important;
    transform: none !important;
    background: var(--vb-bg) !important;
  }
  #loading-indicator {
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    box-sizing: border-box !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
  }
  .vboot-spinner {
    width: 2.5rem !important;
    min-width: 2.5rem !important;
    max-width: 2.5rem !important;
    height: 2.5rem !important;
    min-height: 2.5rem !important;
    max-height: 2.5rem !important;
    margin: 0 !important;
    padding: 0 !important;
    object-fit: contain !important;
    flex: none !important;
    border-radius: 100% !important;
    animation: vboot-spin 2s linear infinite !important;
  }
  .vboot-slow {
    text-align: center;
  }
  .vboot-slow p {
    color: var(--vb-muted);
    font-size: 0.875rem;
    margin: 0 0 0.75rem;
  }
  .vboot-btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--vb-primary);
    color: var(--vb-primary-fg);
    border: none;
    border-radius: 0.375rem;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }
  .vboot-btn:hover {
    opacity: 0.9;
  }
  @media (prefers-reduced-motion: reduce) {
    .vboot-spinner { animation: none; }
  }
`;

function inlineJson(value: string): string {
    return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function normalizedOptions(options: BootScreenOptions) {
    return {
        storageKey: options.storageKey ?? DEFAULT_STORAGE_KEY,
        iconSrc: options.iconSrc ?? DEFAULT_ICON_SRC,
        loadingLabel: options.loadingLabel ?? DEFAULT_LOADING_LABEL,
        autoStart: options.autoStart ?? true,
    };
}

export function renderBootScreenRuntime(options: BootScreenOptions = {}): string {
    const { storageKey, iconSrc, loadingLabel } = normalizedOptions(options);
    return `(() => {
  const storageKey = ${inlineJson(storageKey)};
  const iconSrc = ${inlineJson(iconSrc)};
  const loadingLabel = ${inlineJson(loadingLabel)};
  const previewTheme = (() => {
    try {
      const value = new URL(window.location.href).searchParams.get('__vertesia_boot_theme');
      return value === 'dark' || value === 'light' ? value : null;
    } catch (_error) {
      return null;
    }
  })();
  const prefersDarkTheme = () => {
    if (previewTheme) return previewTheme === 'dark';
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch (_error) {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
    try {
      return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_error) {
      return false;
    }
  };
  const applyTheme = () => {
    const dark = prefersDarkTheme();
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(dark ? 'dark' : 'light');
    return dark;
  };
  const paintDocumentBackground = () => {
    const dark = applyTheme();
    const background = dark ? '#0a0a0a' : '#ffffff';
    const root = document.documentElement;
    root.style.backgroundColor = background;
    root.style.colorScheme = dark ? 'dark' : 'light';
    if (document.body) document.body.style.backgroundColor = background;
  };
  const restoreDocumentBackground = () => {
    applyTheme();
    const root = document.documentElement;
    root.style.removeProperty('background-color');
    root.style.removeProperty('color-scheme');
    if (document.body) document.body.style.removeProperty('background-color');
  };
  const bootThemeClass = () => prefersDarkTheme() ? 'vboot vboot-dark' : 'vboot';
  const ensureLoadingIndicator = () => {
    if (document.getElementById('loading-indicator') || !document.body) return;
    paintDocumentBackground();
    const loading = document.createElement('div');
    loading.id = 'loading-indicator';
    loading.innerHTML = '<div class="' + bootThemeClass() + ' vboot-overlay" role="status" aria-live="polite">'
      + '<img class="vboot-spinner" width="40" height="40" src="' + iconSrc + '" alt="' + loadingLabel + '" />'
      + '<div id="loading-slow-notice" class="vboot-slow" style="display: none;">'
      + '<p>Still loading &mdash; this is taking longer than usual.</p>'
      + '<div id="loading-slow-reload" style="display: none;">'
      + '<button type="button" class="vboot-btn" onclick="window.location.reload()">Reload page</button>'
      + '</div></div></div>';
    const loadingParent = typeof document.documentElement.appendChild === 'function'
      ? document.documentElement
      : document.body;
    loadingParent.appendChild(loading);
  };
  const hideLoadingIndicator = () => {
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.style.display = 'none';
  };
  const hasAppRendered = (rootId = 'root') => {
    const root = document.getElementById(rootId);
    return Boolean(root && root.innerHTML && root.innerHTML.trim() !== '');
  };
  const hideLoadingIndicatorOnFirstRender = (rootId = 'root') => {
    if (typeof MutationObserver !== 'function') return;
    const root = document.getElementById(rootId);
    if (!root) return;
    if (hasAppRendered(rootId)) {
      hideLoadingIndicator();
      restoreDocumentBackground();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!hasAppRendered(rootId)) return;
      hideLoadingIndicator();
      restoreDocumentBackground();
      observer.disconnect();
    });
    observer.observe(root, { childList: true });
  };
  window.__vertesiaBoot = {
    applyTheme,
    bootThemeClass,
    ensureLoadingIndicator,
    hasAppRendered,
    hideLoadingIndicator,
    hideLoadingIndicatorOnFirstRender,
    paintDocumentBackground,
    prefersDarkTheme,
    restoreDocumentBackground,
  };
  paintDocumentBackground();
})();`;
}

export function renderBootScreenHead(options: BootScreenOptions = {}): string {
    return `<style id="vertesia-boot-styles">${BOOT_SCREEN_STYLES}</style>\n<script>${renderBootScreenRuntime(options)}</script>`;
}

export function renderBootScreenInitializer(): string {
    return `<script>window.__vertesiaBoot.ensureLoadingIndicator(); window.__vertesiaBoot.hideLoadingIndicatorOnFirstRender();</script>`;
}

function isHtmlWhitespace(character: string | undefined): boolean {
    return character === ' ' || character === '\t' || character === '\n' || character === '\r' || character === '\f';
}

function hasAttribute(openingTag: string, attributeName: string): boolean {
    const lowerTag = openingTag.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerTag.length) {
        const attributeIndex = lowerTag.indexOf(attributeName, searchFrom);
        if (attributeIndex === -1) return false;

        const before = lowerTag[attributeIndex - 1];
        let afterIndex = attributeIndex + attributeName.length;
        while (isHtmlWhitespace(lowerTag[afterIndex])) afterIndex += 1;
        if (isHtmlWhitespace(before) && lowerTag[afterIndex] === '=') return true;
        searchFrom = attributeIndex + attributeName.length;
    }
    return false;
}

function findOpeningTagEnd(html: string, tagName: string, attributeName?: string): number | undefined {
    const lowerHtml = html.toLowerCase();
    const tagStart = `<${tagName}`;
    let searchFrom = 0;
    while (searchFrom < lowerHtml.length) {
        const start = lowerHtml.indexOf(tagStart, searchFrom);
        if (start === -1) return undefined;

        const boundary = lowerHtml[start + tagStart.length];
        if (boundary === '>' || isHtmlWhitespace(boundary)) {
            const end = lowerHtml.indexOf('>', start + tagStart.length);
            if (end === -1) return undefined;
            if (!attributeName || hasAttribute(lowerHtml.slice(start, end + 1), attributeName)) return end + 1;
            searchFrom = end + 1;
        } else {
            searchFrom = start + tagStart.length;
        }
    }
    return undefined;
}

function insertAt(html: string, index: number, content: string): string {
    return `${html.slice(0, index)}${content}${html.slice(index)}`;
}

export function injectBootScreenHtml(html: string, options: BootScreenOptions = {}): string {
    const normalized = normalizedOptions(options);
    const head = renderBootScreenHead(normalized);
    const insertionPoint = findOpeningTagEnd(html, 'meta', 'charset') ?? findOpeningTagEnd(html, 'head');
    const withHead = insertionPoint === undefined ? html : insertAt(html, insertionPoint, `\n${head}`);
    if (!normalized.autoStart) return withHead;
    const bodyEnd = withHead.toLowerCase().indexOf('</body>');
    return bodyEnd === -1 ? withHead : insertAt(withHead, bodyEnd, `${renderBootScreenInitializer()}\n`);
}

export function createBootScreenVitePlugin(options: BootScreenOptions = {}): BootScreenHtmlPlugin {
    return {
        name: 'vertesia-boot-screen',
        transformIndexHtml: (html) => injectBootScreenHtml(html, options),
    };
}
