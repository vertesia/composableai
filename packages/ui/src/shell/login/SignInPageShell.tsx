/**
 * The chrome around a sign-in step: product logo, the step itself, an optional notice, and the
 * legal footer. Hosts supply their own outer container — the Studio shell overlays the app, the
 * Central Auth broker owns the whole document — so this component deliberately does not position
 * itself.
 */
import { useUITranslation } from '@vertesia/ui/i18n';
import { RegionTag } from '@vertesia/ui/layout';
import type { ReactNode } from 'react';

interface SignInPageShellProps {
    lightLogo?: string;
    darkLogo?: string;
    /** Rendered between the step and the footer — e.g. a generic authentication error. */
    notice?: ReactNode;
    children: ReactNode;
}

export function SignInPageShell({ lightLogo, darkLogo, notice, children }: SignInPageShellProps) {
    const { t } = useUITranslation();
    return (
        <div className="min-h-full flex flex-col items-center justify-center py-12 px-4">
            <div className="flex flex-col items-center w-full">
                {(lightLogo || darkLogo) && (
                    <div className="mb-7">
                        {lightLogo && <img src={lightLogo} alt="Vertesia" className="h-10 block dark:hidden" />}
                        {darkLogo && <img src={darkLogo} alt="Vertesia" className="h-10 hidden dark:block" />}
                    </div>
                )}

                {children}

                {notice}

                <div className="flex items-center gap-5 mt-10 text-xs text-muted-foreground">
                    <a href="https://vertesiahq.com/privacy" className="hover:text-foreground transition">
                        {t('auth.privacyPolicy')}
                    </a>
                    <span className="text-border">·</span>
                    <a href="https://vertesiahq.com/terms" className="hover:text-foreground transition">
                        {t('auth.termsOfService')}
                    </a>
                    <span className="text-border">·</span>
                    <RegionTag className="cursor-default" />
                </div>
            </div>
        </div>
    );
}
