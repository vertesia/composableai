import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { i18nInstance, NAMESPACE } from './instance.js';
import { isRTL, RTL_LANGUAGES, resolveLanguage, SUPPORTED_LANGUAGES } from './rtl.js';

describe('isRTL', () => {
    it.each(['ar', 'he', 'fa', 'ur'])('returns true for %s', (lng) => {
        expect(isRTL(lng)).toBe(true);
    });

    it('returns true for region-tagged RTL locales', () => {
        expect(isRTL('ar-EG')).toBe(true);
        expect(isRTL('ar-SA')).toBe(true);
        expect(isRTL('AR')).toBe(true); // case-insensitive on base
    });

    it.each(['en', 'fr', 'de', 'es', 'zh', 'zh-TW', 'ja', 'ko', 'pt-BR'])('returns false for %s', (lng) => {
        expect(isRTL(lng)).toBe(false);
    });

    it('returns false for empty / undefined', () => {
        expect(isRTL(undefined)).toBe(false);
        expect(isRTL('')).toBe(false);
    });
});

describe('resolveLanguage', () => {
    it('preserves zh-TW as an exact match (not collapsed to zh)', () => {
        expect(resolveLanguage('zh-TW')).toBe('zh-TW');
    });

    it('collapses non-supported region tags to the base language', () => {
        expect(resolveLanguage('zh-HK')).toBe('zh');
        expect(resolveLanguage('pt-BR')).toBe('pt');
        expect(resolveLanguage('en-US')).toBe('en');
        expect(resolveLanguage('ar-EG')).toBe('ar');
    });

    it('returns en for unknown languages', () => {
        expect(resolveLanguage('xx')).toBe('en');
        expect(resolveLanguage('xx-YY')).toBe('en');
    });

    it('returns en for empty / null / undefined', () => {
        expect(resolveLanguage(undefined)).toBe('en');
        expect(resolveLanguage(null)).toBe('en');
        expect(resolveLanguage('')).toBe('en');
    });

    it('passes through every supported language unchanged', () => {
        for (const lng of SUPPORTED_LANGUAGES) {
            expect(resolveLanguage(lng)).toBe(lng);
        }
    });
});

describe('RTL_LANGUAGES set', () => {
    it('contains he/fa/ur even though they are not in SUPPORTED_LANGUAGES', () => {
        expect(RTL_LANGUAGES.has('he')).toBe(true);
        expect(RTL_LANGUAGES.has('fa')).toBe(true);
        expect(RTL_LANGUAGES.has('ur')).toBe(true);
        const supportedSet = new Set<string>(SUPPORTED_LANGUAGES as readonly string[]);
        expect(supportedSet.has('he')).toBe(false);
        expect(supportedSet.has('fa')).toBe(false);
        expect(supportedSet.has('ur')).toBe(false);
    });
});

describe('SUPPORTED_LANGUAGES divergence guard', () => {
    it('matches exactly the locales registered in i18nInstance.options.resources', () => {
        const registered = Object.keys(i18nInstance.options.resources ?? {}).sort();
        const supported = [...SUPPORTED_LANGUAGES].sort();
        expect(registered).toEqual(supported);
    });
});

describe('empty translation fallback', () => {
    it('falls back to English for empty translation values', async () => {
        const testI18n = i18next.createInstance();
        await testI18n.init({
            resources: {
                en: { [NAMESPACE]: { 'test.emptyTranslationFallback': 'English fallback' } },
                zh: { [NAMESPACE]: { 'test.emptyTranslationFallback': '' } },
            },
            fallbackLng: 'en',
            returnEmptyString: false,
            ns: [NAMESPACE],
            defaultNS: NAMESPACE,
            interpolation: {
                escapeValue: false,
            },
        });

        const t = testI18n.getFixedT('zh', NAMESPACE);
        expect(t('test.emptyTranslationFallback')).toBe('English fallback');
    });

    it('does not ship parser-created empty locale entries', () => {
        const resources = i18nInstance.options.resources ?? {};
        const emptyEntries: string[] = [];

        const collectEmptyEntries = (value: unknown, path: string[]) => {
            if (typeof value === 'string') {
                if (value.trim() === '') {
                    emptyEntries.push(path.join('.'));
                }
                return;
            }

            if (Array.isArray(value)) {
                for (const [index, item] of value.entries()) {
                    collectEmptyEntries(item, [...path, String(index)]);
                }
                return;
            }

            if (value && typeof value === 'object') {
                for (const [key, child] of Object.entries(value)) {
                    collectEmptyEntries(child, [...path, key]);
                }
            }
        };

        for (const [locale, resource] of Object.entries(resources)) {
            collectEmptyEntries(resource, [locale]);
        }

        expect(emptyEntries).toEqual([]);
    });
});
