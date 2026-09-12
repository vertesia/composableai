import { Button } from '@vertesia/ui/core';
import type { PermissionLoadingScreenProps } from '@vertesia/ui/features';
import { UITranslationOverrides, useUITranslation } from '@vertesia/ui/i18n';
import { createContext, type ReactNode, useContext, useId, useMemo } from 'react';
import { type AppBranding, renderBrandStyles } from '../boot/branding.js';
import type { SignInScreenViewProps } from './login/SigninScreen';
import type { AuthLoadingScreenProps } from './SplashScreen';
import type { AuthScreens } from './VertesiaShell';

const BrandingContext = createContext<AppBranding>({ name: '' });

export function AppBrandingProvider({ branding, children }: { branding: AppBranding; children: ReactNode }) {
    const overrides = useMemo(() => {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(branding.copy?.translations ?? {})) {
            if (key.startsWith('auth.') || key.startsWith('signup.')) result[key] = value;
        }
        if (branding.copy?.welcome !== undefined) result['auth.email.title'] = branding.copy.welcome;
        if (branding.copy?.emailPlaceholder !== undefined)
            result['auth.email.placeholder'] = branding.copy.emailPlaceholder;
        return result;
    }, [branding]);
    return (
        <BrandingContext.Provider value={branding}>
            <UITranslationOverrides overrides={overrides}>{children}</UITranslationOverrides>
        </BrandingContext.Provider>
    );
}

function BrandPage({ children }: { children: ReactNode }) {
    const brand = useContext(BrandingContext);
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const logo = brand.logo;
    return (
        <main className="vbrand" data-vbrand={id}>
            <style>{renderBrandStyles(brand, `[data-vbrand="${id}"]`)}</style>
            <div className="vbrand-panel">
                {logo && (
                    <>
                        <img className="vbrand-logo vbrand-logo-light" src={logo.light} alt={logo.alt ?? brand.name} />
                        <img
                            className="vbrand-logo vbrand-logo-dark"
                            src={logo.dark ?? logo.light}
                            alt={logo.alt ?? brand.name}
                        />
                    </>
                )}
                <h1 className="vbrand-heading">{brand.name}</h1>
                {children}
                {brand.copy?.footer && <p className="text-sm text-muted">{brand.copy.footer}</p>}
            </div>
        </main>
    );
}

export function BrandedAuthLoadingScreen({ loadingIcon }: AuthLoadingScreenProps) {
    const brand = useContext(BrandingContext);
    const { t } = useUITranslation();
    return (
        <BrandPage>
            <div className="vbrand-panel vbrand-status" role="status" aria-live="polite">
                <div aria-hidden="true">{loadingIcon ?? <div className="vbrand-spinner" />}</div>
                <p>{brand.copy?.loading ?? t('auth.pending.authenticating')}</p>
            </div>
        </BrandPage>
    );
}

export function BrandedSignInScreen({ children, notice, flow, authError }: SignInScreenViewProps) {
    if (flow.mode === 'pending' && !authError) return <BrandedAuthLoadingScreen />;
    return (
        <BrandPage>
            {children}
            {notice}
        </BrandPage>
    );
}

export function BrandedPermissionLoadingScreen({
    status,
    title,
    description,
    loadingIcon,
    actionLabel,
    onAction,
}: PermissionLoadingScreenProps) {
    const brand = useContext(BrandingContext);
    const failed = status === 'error';
    return (
        <BrandPage>
            {!failed && <div aria-hidden="true">{loadingIcon ?? <div className="vbrand-spinner" />}</div>}
            <div
                className="vbrand-status"
                role={failed ? 'alert' : 'status'}
                aria-live={failed ? 'assertive' : 'polite'}
            >
                <h2 className="text-xl font-semibold">{failed ? title : (brand.copy?.loading ?? title)}</h2>
                <p className="mt-2 text-muted">{description}</p>
            </div>
            {failed && <Button onClick={onAction}>{actionLabel}</Button>}
        </BrandPage>
    );
}

export const brandedAuthScreens: AuthScreens = {
    SignIn: BrandedSignInScreen,
    Loading: BrandedAuthLoadingScreen,
    Permissions: BrandedPermissionLoadingScreen,
};
