import { ThemeProvider, ToastProvider } from '@vertesia/ui/core';
import { TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features';
import { LanguageBoundI18nProvider, LanguageProvider, type SupportedLanguage } from '@vertesia/ui/i18n';
import { DevSessionProvider, UserSessionProvider } from '@vertesia/ui/session';
import type { ReactNode } from 'react';
import { SigninScreen } from './login/SigninScreen';
import { SplashScreen } from './SplashScreen';

interface VertesiaShellProps {
    children: React.ReactNode;
    lightLogo?: string;
    darkLogo?: string;
    loadingIcon?: ReactNode;
    loadOnboardingStatus?: boolean;
    preserveSignInPath?: boolean;
    suppressSignInErrorPrefixes?: string | string[];
    /** Use an already-issued Vertesia token instead of starting the normal sign-in flow. */
    authToken?: string;
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
    suppressSignInErrorPrefixes,
    authToken,
    defaultLanguage,
}: VertesiaShellProps) {
    const content = (
        <TypeRegistryProvider>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <LanguageProvider defaultLanguage={defaultLanguage}>
                    <LanguageBoundI18nProvider>
                        {!authToken && (
                            <>
                                <SplashScreen icon={loadingIcon} />
                                <SigninScreen
                                    allowedPrefix="/shared/"
                                    darkLogo={darkLogo}
                                    lightLogo={lightLogo}
                                    preservePath={preserveSignInPath}
                                    suppressAuthErrorPrefix={suppressSignInErrorPrefixes}
                                />
                            </>
                        )}
                        <UserPermissionProvider>{children}</UserPermissionProvider>
                    </LanguageBoundI18nProvider>
                </LanguageProvider>
            </ThemeProvider>
        </TypeRegistryProvider>
    );

    return (
        <ToastProvider>
            {authToken ? (
                <DevSessionProvider token={authToken}>{content}</DevSessionProvider>
            ) : (
                <UserSessionProvider loadOnboardingStatus={loadOnboardingStatus}>{content}</UserSessionProvider>
            )}
        </ToastProvider>
    );
}
