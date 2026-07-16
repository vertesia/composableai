import { Heading, LanguageSwitcher, ModeToggle } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';

export function SettingsPage() {
    const { t } = useUITranslation();

    return (
        <div className="p-6 space-y-6 max-w-xl">
            <Heading level={1}>{t('nav.settings')}</Heading>
            <section className="space-y-3">
                <h2 className="text-base font-semibold">{t('theme.label')}</h2>
                <ModeToggle label={false} />
            </section>
            <section className="space-y-3">
                <h2 className="text-base font-semibold">{t('language.label')}</h2>
                <LanguageSwitcher label={false} />
            </section>
        </div>
    );
}
