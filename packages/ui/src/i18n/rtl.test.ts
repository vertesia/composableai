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
    it('falls back to English for parser-created empty locale entries', () => {
        const t = i18nInstance.getFixedT('zh', NAMESPACE);
        expect(t('agent.browserPreview')).toBe('Browser preview');
    });
});
