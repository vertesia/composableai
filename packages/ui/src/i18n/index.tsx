import { useEffect, type ReactNode } from 'react';
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

    return (
        <I18nextProvider i18n={i18nInstance}>
            {children}
        </I18nextProvider>
    );
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
export function useUITranslation() {
    return useTranslation(NAMESPACE, { i18n: i18nInstance });
}

export { i18nInstance, NAMESPACE } from './instance.js';
export {
    LanguageProvider,
    LanguageProviderContext,
    useLanguage,
} from './LanguageProvider.js';
export {
    RTL_LANGUAGES,
    SUPPORTED_LANGUAGES,
    isRTL,
    resolveLanguage,
    type SupportedLanguage,
} from './rtl.js';
