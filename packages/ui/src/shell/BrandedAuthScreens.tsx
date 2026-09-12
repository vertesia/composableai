import { DefaultPermissionLoadingScreen, type PermissionLoadingScreenProps } from '@vertesia/ui/features';
import { UITranslationOverrides } from '@vertesia/ui/i18n';
import { createContext, type ReactNode, useContext, useEffect, useId, useMemo, useState } from 'react';
import { type AppBranding, renderBrandStyles } from '../boot/branding.js';
import { DefaultSignInScreen, type SignInScreenViewProps } from './login/SigninScreen';
import { type AuthLoadingScreenProps, DefaultAuthLoadingScreen, LoadingAnimation } from './SplashScreen';
import type { AuthScreens } from './VertesiaShell';

const BrandingContext = createContext<AppBranding>({ name: '' });

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

function BrandLoadingIcon({ brand }: { brand: AppBranding }) {
    if (!brand.loadingIcon) return null;
    return (
        <>
            <img src={brand.loadingIcon.light} alt="" className="w-10 h-auto rounded-full block dark:hidden" />
            <img
                src={brand.loadingIcon.dark ?? brand.loadingIcon.light}
                alt=""
                className="w-10 h-auto rounded-full hidden dark:block"
            />
        </>
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

/** Brand-aware loading indicator that stays inside its container instead of covering the app shell. */
export function BrandedLoadingIndicator({ loadingIcon, delayMs = 0 }: AuthLoadingScreenProps & { delayMs?: number }) {
    const brand = useContext(BrandingContext);
    const [visible, setVisible] = useState(delayMs <= 0);
    useEffect(() => {
        if (delayMs <= 0) {
            setVisible(true);
            return;
        }
        setVisible(false);
        const timer = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);
    if (!visible) return null;
    return (
        <div role="status" aria-label={brand.copy?.loading ?? 'Loading'}>
            <LoadingAnimation
                loadingIcon={loadingIcon ?? (brand.loadingIcon ? <BrandLoadingIcon brand={brand} /> : undefined)}
            />
        </div>
    );
}
