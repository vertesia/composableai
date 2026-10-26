/**
 * RTL detection and language resolution for the @vertesia/ui locale set.
 *
 * SUPPORTED_LANGUAGES is the single source of truth for what locales the
 * switcher offers, and must stay in sync with the resources registered in
 * `./instance.ts`. A divergence-guard test (`./rtl.test.ts`) fails the build
 * if the two diverge.
 *
 * RTL_LANGUAGES is deliberately broader than SUPPORTED_LANGUAGES so that
 * dir="rtl" handling is forward-compatible when new RTL locales (he, fa, ur,
 * ...) are added to instance.ts later.
 */

export const SUPPORTED_LANGUAGES = [
    'ar',
    'de',
    'en',
    'es',
    'fr',
    'it',
    'ja',
    'ko',
    'pt',
    'ru',
    'tr',
    'zh',
    'zh-TW',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Where `LanguageProvider` persists the chosen language; the boot runtime reads it too. */
export const LANGUAGE_STORAGE_KEY = 'vertesia-ui-language';

export const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

export function isRTL(lng?: string): boolean {
    if (!lng) return false;
    return RTL_LANGUAGES.has(lng.split('-')[0].toLowerCase());
}

/**
 * Resolve any raw language code (BCP-47 or bare) to a SupportedLanguage:
 *   1. exact match against SUPPORTED_LANGUAGES (preserves `zh-TW` vs `zh`)
 *   2. base-language fallback (`pt-BR` -> `pt`)
 *   3. `'en'` fallback
 *
 * The pre-React boot runtime (`../boot/index.ts`) reimplements this same logic
 * in its inline script, which runs before any bundle loads.
 */
export function resolveLanguage(raw: string | undefined | null): SupportedLanguage {
    if (!raw) return 'en';
    const list = SUPPORTED_LANGUAGES as readonly string[];
    if (list.includes(raw)) return raw as SupportedLanguage;
    const base = raw.split('-')[0];
    if (list.includes(base)) return base as SupportedLanguage;
    return 'en';
}
