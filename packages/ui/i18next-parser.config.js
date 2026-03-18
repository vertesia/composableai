/** @type {import('i18next-parser').UserConfig} */
export default {
    locales: ['en', 'fr', 'es', 'de', 'pt', 'zh', 'zh-TW', 'ja', 'it', 'ru', 'ko', 'tr', 'ar'],
    output: 'src/i18n/locales/$LOCALE.json',
    input: ['src/**/*.{ts,tsx}'],
    sort: true,

    // Use the flat key separator (dots in key names, not nested objects)
    namespaceSeparator: false,
    keySeparator: false,

    // Keep existing translations even if t() calls are not found
    // (some keys are used via useUITranslation() which the parser can't always detect)
    keepRemoved: true,

    // Default value for new keys = the key itself (so English reads naturally)
    defaultValue: (locale, _namespace, key) => {
        // For English, use the key value from en.json (already correct)
        // For other locales, leave empty string so we know what needs translating
        return locale === 'en' ? key : '';
    },

    // i18next options
    i18nextOptions: {
        defaultNS: 'vertesia.ui',
        ns: ['vertesia.ui'],
    },

    // Only extract from our useUITranslation hook and direct t() calls
    lexers: {
        ts: ['JavascriptLexer'],
        tsx: [{
            lexer: 'JsxLexer',
            functions: ['t'],
            attr: false,
        }],
    },
};
