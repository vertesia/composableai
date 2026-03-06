import { useEffect, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { i18nInstance, NAMESPACE } from './instance.js';

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
 * Hook for components inside @vertesia/ui to get translation functions.
 * Always binds to the 'vertesia.ui' namespace on the scoped instance.
 */
export function useUITranslation() {
    return useTranslation(NAMESPACE, { i18n: i18nInstance });
}

export { i18nInstance, NAMESPACE } from './instance.js';
