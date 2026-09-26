import { DefaultPermissionLoadingScreen, type PermissionLoadingScreenProps } from '@vertesia/ui/features';
import { UITranslationOverrides } from '@vertesia/ui/i18n';
import { type ReactNode, useContext, useId, useMemo } from 'react';
import { type AppBranding, renderBrandStyles } from '../boot/branding.js';
import { BrandedLoadingIndicator, BrandingContext, BrandLoadingIcon } from './BrandedLoadingIndicator';
import { DefaultSignInScreen, type SignInScreenViewProps } from './login/SigninScreen';
import { type AuthLoadingScreenProps, DefaultAuthLoadingScreen } from './SplashScreen';
import type { AuthScreens } from './VertesiaShell';

export { BrandedLoadingIndicator } from './BrandedLoadingIndicator';

export function AppBrandingProvider({ branding, children }: { branding: AppBranding; children: ReactNode }) {
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
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
            <div data-vbrand={id} style={{ display: 'contents' }}>
                <style>{renderBrandStyles(branding, `[data-vbrand="${id}"]`)}</style>
                <UITranslationOverrides overrides={overrides}>{children}</UITranslationOverrides>
            </div>
        </BrandingContext.Provider>
    );
}

export function BrandedAuthLoadingScreen({ loadingIcon }: AuthLoadingScreenProps) {
    const brand = useContext(BrandingContext);
    return (
        <DefaultAuthLoadingScreen
            loadingIcon={loadingIcon ?? (brand.loadingIcon ? <BrandLoadingIcon brand={brand} /> : undefined)}
            loadingLabel={brand.copy?.loading}
        />
    );
}

export function BrandedSignInScreen({ children, notice, isNested, lightLogo, darkLogo }: SignInScreenViewProps) {
    const brand = useContext(BrandingContext);
    return (
        <DefaultSignInScreen
            isNested={isNested}
            lightLogo={brand.logo?.light ?? lightLogo}
            darkLogo={brand.logo?.dark ?? brand.logo?.light ?? darkLogo}
            logoAlt={brand.logo?.alt ?? brand.name}
            footer={brand.copy?.footer}
            notice={notice}
        >
            {children}
        </DefaultSignInScreen>
    );
}

export function BrandedPermissionLoadingScreen(props: PermissionLoadingScreenProps) {
    const brand = useContext(BrandingContext);
    return (
        <DefaultPermissionLoadingScreen
            {...props}
            description={props.status === 'error' ? props.description : (brand.copy?.loading ?? props.description)}
            loadingIcon={
                props.status === 'error' ? (
                    (props.loadingIcon ?? (brand.loadingIcon ? <BrandLoadingIcon brand={brand} /> : undefined))
                ) : (
                    <BrandedLoadingIndicator loadingIcon={props.loadingIcon} />
                )
            }
        />
    );
}

export const brandedAuthScreens: AuthScreens = {
    SignIn: BrandedSignInScreen,
    Loading: BrandedAuthLoadingScreen,
    Permissions: BrandedPermissionLoadingScreen,
};
