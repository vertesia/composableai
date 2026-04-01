import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: [
    'en', 'fr', 'es', 'de', 'pt', 'zh', 'zh-TW',
    'ja', 'it', 'ru', 'ko', 'tr', 'ar'
  ],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}.json',
    defaultNS: 'vertesia.ui',
    keySeparator: false,
    nsSeparator: false,
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
  },
  types: {
    input: ['src/i18n/locales/{{language}}.json'],
    output: 'src/types/i18next.d.ts',
  },
});
