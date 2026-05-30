import { ThemeProvider, ToastProvider } from '@vertesia/ui/core';
import { UserPermissionProvider, TypeRegistryProvider } from '@vertesia/ui/features';
import { LanguageBoundI18nProvider, LanguageProvider, type SupportedLanguage } from '@vertesia/ui/i18n';
import { UserSessionProvider } from '@vertesia/ui/session';
import { SplashScreen } from './SplashScreen';
import { SigninScreen } from './login/SigninScreen';
import type { ReactNode } from 'react';

interface VertesiaShellProps {
    children: React.ReactNode;
    lightLogo?: string;
    darkLogo?: string;
    loadingIcon?: ReactNode;
    loadOnboardingStatus?: boolean;
    preserveSignInPath?: boolean;
    /** Force a default language. If omitted, falls back to localStorage then navigator.language then 'en'. */
    defaultLanguage?: SupportedLanguage;
}
export function VertesiaShell({
    children,
    lightLogo,
    darkLogo,
    loadingIcon,
    loadOnboardingStatus,
    preserveSignInPath,
    defaultLanguage,
}: VertesiaShellProps) {
    return (
        <ToastProvider>
            <UserSessionProvider loadOnboardingStatus={loadOnboardingStatus}>
                <TypeRegistryProvider>
                    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                        <LanguageProvider defaultLanguage={defaultLanguage}>
                            <LanguageBoundI18nProvider>
                                <SplashScreen icon={loadingIcon} />
                                <SigninScreen
                                    allowedPrefix="/shared/"
                                    darkLogo={darkLogo}
                                    lightLogo={lightLogo}
                                    preservePath={preserveSignInPath}
                                />
                                <UserPermissionProvider>{children}</UserPermissionProvider>
                            </LanguageBoundI18nProvider>
                        </LanguageProvider>
                    </ThemeProvider>
                </TypeRegistryProvider>
            </UserSessionProvider>
        </ToastProvider>
    );
}
