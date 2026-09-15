import { afterAll, describe, expect, it } from 'vitest';
import { i18nInstance } from './instance.js';

const KEY = 'abac_perms.collection.content_manager';

describe('i18n instance', () => {
    afterAll(async () => {
        await i18nInstance.changeLanguage('en');
    });

    it('serves the bundled English fallback', async () => {
        await i18nInstance.changeLanguage('en');
        expect(i18nInstance.t(KEY)).toBe('Collection Manager');
    });

    it('loads a locale that is not bundled', async () => {
        await i18nInstance.changeLanguage('fr');
        expect(i18nInstance.t(KEY)).toBe('Gestionnaire de collection');
    });

    it('keeps a region-tagged locale distinct from its base language', async () => {
        await i18nInstance.changeLanguage('zh-TW');
        expect(i18nInstance.t(KEY)).not.toBe('Collection Manager');
    });

    it('falls back to English for an unsupported language', async () => {
        await i18nInstance.changeLanguage('nl');
        expect(i18nInstance.t(KEY)).toBe('Collection Manager');
    });
});
