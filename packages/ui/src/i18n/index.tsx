import type { i18n } from 'i18next';
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { I18nextProvider, Trans, useTranslation } from 'react-i18next';
import { i18nInstance, NAMESPACE } from './instance.js';
import { useLanguage } from './LanguageProvider.js';

export { Trans };

export interface I18nProviderProps {
    /** Force a specific language. If omitted, uses browser language detection with 'en' fallback. */
    lng?: string;
    children: ReactNode;
}

function detectLanguage(lng?: string): string {
    return lng ?? navigator.language?.split('-')[0] ?? 'en';
}

export function I18nProvider({ lng, children }: I18nProviderProps) {
    // Set language synchronously on first render to avoid flash of wrong language
    const language = detectLanguage(lng);
    if (i18nInstance.language !== language) {
        void i18nInstance.changeLanguage(language);
    }

    // Also react to prop changes
    useEffect(() => {
        const lang = detectLanguage(lng);
        if (i18nInstance.language !== lang) {
            void i18nInstance.changeLanguage(lang);
        }
    }, [lng]);

    return <I18nextProvider i18n={i18nInstance}>{children}</I18nextProvider>;
}

/**
 * Binds i18next to the language reported by the surrounding `LanguageProvider`.
 * Use this inside `VertesiaShell` (or wherever a `LanguageProvider` ancestor is
 * available) so language changes propagate to all `useUITranslation()` callers
 * without a static `lng` prop.
 */
export function LanguageBoundI18nProvider({ children }: { children: ReactNode }) {
    const { language } = useLanguage();
    return <I18nProvider lng={language}>{children}</I18nProvider>;
}

/**
 * Hook for components inside @vertesia/ui to get translation functions.
 * Always binds to the 'vertesia.ui' namespace on the scoped instance.
 */
const TranslationInstanceContext = createContext<i18n | undefined>(undefined);

/** Overrides are scoped to this subtree and never mutate the shared translation resources. */
export function UITranslationOverrides({
    overrides,
    children,
}: {
    overrides: Record<string, string>;
    children: ReactNode;
}) {
    const parent = useContext(TranslationInstanceContext) ?? i18nInstance;
    const { i18n: current } = useTranslation(NAMESPACE, { i18n: parent });
    const language = current.resolvedLanguage ?? current.language;
    const instance = useMemo(() => {
        const clone = parent.cloneInstance({ forkResourceStore: true, lng: language, initAsync: false });
        clone.addResourceBundle(language, NAMESPACE, overrides, true, true);
        return clone;
    }, [parent, language, overrides]);
    return <TranslationInstanceContext.Provider value={instance}>{children}</TranslationInstanceContext.Provider>;
}

export function useUITranslation() {
    const instance = useContext(TranslationInstanceContext) ?? i18nInstance;
    return useTranslation(NAMESPACE, { i18n: instance });
}

export { i18nInstance, NAMESPACE } from './instance.js';
export {
    LanguageProvider,
    LanguageProviderContext,
    useLanguage,
} from './LanguageProvider.js';
export {
    isRTL,
    RTL_LANGUAGES,
    resolveLanguage,
    SUPPORTED_LANGUAGES,
    type SupportedLanguage,
} from './rtl.js';
export { type LocaleFormat, useLocaleFormat } from './useLocaleFormat.js';
