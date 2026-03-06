import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const NAMESPACE = 'vertesia.ui';

// Scoped instance — does NOT touch the global i18next singleton
const i18nInstance: i18n = i18next.createInstance();

void i18nInstance.use(initReactI18next).init({
    resources: {
        en: { [NAMESPACE]: en },
        fr: { [NAMESPACE]: fr },
    },
    fallbackLng: 'en',
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    interpolation: {
        escapeValue: false, // React already escapes
    },
    react: {
        useSuspense: false, // Translations are bundled, no async loading
    },
});

export { i18nInstance };
