import { ThemeProvider, ToastProvider } from '@vertesia/ui/core';
import { type PermissionLoadingScreenProps, TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features';
import { LanguageBoundI18nProvider, LanguageProvider, type SupportedLanguage } from '@vertesia/ui/i18n';
import { DevSessionProvider, UserSessionProvider } from '@vertesia/ui/session';
import type { ComponentType, ReactNode } from 'react';
import type { AppBranding } from '../boot/branding.js';
import { IframeAppContextSync } from './apps/IframeAppContextSync.js';
import { AppBrandingProvider, BrandedAuthLoadingScreen, brandedAuthScreens } from './BrandedAuthScreens';
import { type SignInScreenViewProps, SigninScreen } from './login/SigninScreen';
import { type AuthLoadingScreenProps, SplashScreen } from './SplashScreen';

/** Optional full-page presentations. Session and permission gating remain owned by the shell. */
export interface AuthScreens {
    SignIn?: ComponentType<SignInScreenViewProps>;
    Loading?: ComponentType<AuthLoadingScreenProps>;
    Permissions?: ComponentType<PermissionLoadingScreenProps>;
}

export interface VertesiaShellProps {
    authScreens?: AuthScreens;
    branding?: AppBranding;
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
    authScreens,
    branding,
}: VertesiaShellProps) {
    const screens = { ...(branding ? brandedAuthScreens : {}), ...authScreens };
    const brandedContent = (
        <TypeRegistryProvider>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <LanguageProvider defaultLanguage={defaultLanguage}>
                    <LanguageBoundI18nProvider>
                        <AppBrandingBoundary branding={branding}>
                            <IframeAppContextSync />
                            {!authToken && (
                                <>
                                    <SplashScreen
                                        icon={loadingIcon}
                                        Screen={authScreens?.Loading}
                                        Presentation={branding ? BrandedAuthLoadingScreen : undefined}
                                    />
                                    <SigninScreen
                                        View={screens.SignIn}
                                        allowedPrefix="/shared/"
                                        darkLogo={darkLogo}
                                        lightLogo={lightLogo}
                                        preservePath={preserveSignInPath}
                                        suppressAuthErrorPrefix={suppressSignInErrorPrefixes}
                                    />
                                </>
                            )}
                            <UserPermissionProvider loadingIcon={loadingIcon} LoadingScreen={screens.Permissions}>
                                {children}
                            </UserPermissionProvider>
                        </AppBrandingBoundary>
                    </LanguageBoundI18nProvider>
                </LanguageProvider>
            </ThemeProvider>
        </TypeRegistryProvider>
    );

    return (
        <ToastProvider>
            {authToken ? (
                <DevSessionProvider token={authToken}>{brandedContent}</DevSessionProvider>
            ) : (
                <UserSessionProvider loadOnboardingStatus={loadOnboardingStatus}>{brandedContent}</UserSessionProvider>
            )}
        </ToastProvider>
    );
}

function AppBrandingBoundary({ branding, children }: { branding?: AppBranding; children: ReactNode }) {
    return branding ? <AppBrandingProvider branding={branding}>{children}</AppBrandingProvider> : children;
}
