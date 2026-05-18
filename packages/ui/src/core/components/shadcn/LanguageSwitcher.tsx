// IMPORTANT: this MUST import via the @vertesia/ui/i18n subpath, not a
// relative path. The Rollup config externalizes @vertesia/ui/* subpaths via
// regex; a relative `../../../i18n/index.js` would bundle the entire i18n
// module (including LanguageProviderContext) into vertesia-ui-core.js,
// creating a private context separate from the one the shell mounts.
// setLanguage would then no-op.
import { SUPPORTED_LANGUAGES, useLanguage, useUITranslation, type SupportedLanguage } from '@vertesia/ui/i18n';
import { SelectBox } from './selectBox';

/**
 * Endonyms (a language's name written in itself). Kept as plain strings — they
 * intentionally do NOT go through i18n, since each label should render in its
 * own script regardless of the active locale.
 */
const ENDONYMS: Record<SupportedLanguage, string> = {
    ar: 'العربية',
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    pt: 'Português',
    ru: 'Русский',
    tr: 'Türkçe',
    zh: '中文',
    'zh-TW': '繁體中文',
};

interface LanguageSwitcherProps {
    /** Label shown to the left of the dropdown. Defaults to translated "Language". Pass `false` to hide. */
    label?: string | false;
    className?: string;
}

export function LanguageSwitcher({ label, className }: LanguageSwitcherProps = {}) {
    const { language, setLanguage } = useLanguage();
    const { t } = useUITranslation();
    const resolvedLabel = label === false ? false : (label ?? t('language.label'));

    return (
        <div className={className ?? (resolvedLabel ? 'flex justify-between px-2 items-center gap-3' : 'flex items-center')}>
            {resolvedLabel && <p className="text-sm font-semibold">{resolvedLabel}</p>}
            <SelectBox<SupportedLanguage>
                options={SUPPORTED_LANGUAGES as readonly SupportedLanguage[] as SupportedLanguage[]}
                value={language}
                onChange={(next) => setLanguage(next)}
                optionLabel={(option) => ENDONYMS[option]}
                placeholder={t('language.placeholder')}
                isClearable={false}
                warnOnMissingValue={false}
                className="min-w-40"
            />
        </div>
    );
}
