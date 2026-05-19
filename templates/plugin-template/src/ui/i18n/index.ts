import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
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

const bundles: Record<string, Record<string, string>> = {
    ar,
    de,
    en,
    es,
    fr,
    it,
    ja,
    ko,
    pt,
    ru,
    tr,
    zh,
    'zh-TW': zhTW,
};

for (const [lng, resources] of Object.entries(bundles)) {
    i18nInstance.addResourceBundle(lng, NAMESPACE, resources, true, false);
}
