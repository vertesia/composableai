import i18next, { type BackendModule, type i18n, type ReadCallback } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export const NAMESPACE = 'vertesia.ui';

type LocaleLoader = () => Promise<{ default: Record<string, unknown> }>;

/**
 * Every locale except the `en` fallback is fetched the first time it is selected. Bundling all
 * thirteen costs ~1 MB of JSON, of which a given user reads at most one — and the fallback covers
 * the gap while a translation is in flight.
 */
const LOCALE_LOADERS: Record<string, LocaleLoader> = {
    ar: () => import('./locales/ar.json'),
    de: () => import('./locales/de.json'),
    es: () => import('./locales/es.json'),
    fr: () => import('./locales/fr.json'),
    it: () => import('./locales/it.json'),
    ja: () => import('./locales/ja.json'),
    ko: () => import('./locales/ko.json'),
    pt: () => import('./locales/pt.json'),
    ru: () => import('./locales/ru.json'),
    tr: () => import('./locales/tr.json'),
    zh: () => import('./locales/zh.json'),
    'zh-TW': () => import('./locales/zh-TW.json'),
};

/** Every locale this instance can serve: the bundled `en` fallback plus the lazily loaded ones. */
export const AVAILABLE_LOCALES: readonly string[] = ['en', ...Object.keys(LOCALE_LOADERS)];

const lazyLocaleBackend: BackendModule = {
    type: 'backend',
    init: () => {
        // no configuration: the locale set is fixed at build time
    },
    read(language: string, _namespace: string, callback: ReadCallback) {
        const load = LOCALE_LOADERS[language];
        if (!load) {
            // Unsupported language: report an empty bundle so i18next falls back to `en`
            callback(null, {});
            return;
        }
        load().then(
            (locale) => callback(null, locale.default),
            (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), false),
        );
    },
};

// Scoped instance — does NOT touch the global i18next singleton
const i18nInstance: i18n = i18next.createInstance();

void i18nInstance
    .use(lazyLocaleBackend)
    .use(initReactI18next)
    .init({
        // `en` stays bundled so the fallback — and the common case — needs no round trip
        resources: {
            en: { [NAMESPACE]: en },
        },
        // Required to consult the backend even though `resources` are supplied
        partialBundledLanguages: true,
        fallbackLng: 'en',
        returnEmptyString: false,
        ns: [NAMESPACE],
        defaultNS: NAMESPACE,
        interpolation: {
            escapeValue: false, // React already escapes
        },
        react: {
            // Render the `en` fallback while a locale loads rather than suspending the tree
            useSuspense: false,
        },
    });

export { i18nInstance };
