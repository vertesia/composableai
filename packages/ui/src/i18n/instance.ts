import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';

export const NAMESPACE = 'vertesia.ui';

// Scoped instance — does NOT touch the global i18next singleton
const i18nInstance: i18n = i18next.createInstance();

void i18nInstance.use(initReactI18next).init({
    resources: {
        ar: { [NAMESPACE]: ar },
        de: { [NAMESPACE]: de },
        en: { [NAMESPACE]: en },
        es: { [NAMESPACE]: es },
        fr: { [NAMESPACE]: fr },
        it: { [NAMESPACE]: it },
        ja: { [NAMESPACE]: ja },
        ko: { [NAMESPACE]: ko },
        pt: { [NAMESPACE]: pt },
        ru: { [NAMESPACE]: ru },
        tr: { [NAMESPACE]: tr },
        zh: { [NAMESPACE]: zh },
        'zh-TW': { [NAMESPACE]: zhTW },
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
