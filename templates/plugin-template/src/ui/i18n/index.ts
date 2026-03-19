import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';

const bundles: Record<string, Record<string, string>> = { en, fr };

for (const [lng, resources] of Object.entries(bundles)) {
    i18nInstance.addResourceBundle(lng, NAMESPACE, resources, true, false);
}
