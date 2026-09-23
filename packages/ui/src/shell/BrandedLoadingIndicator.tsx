import { createContext, useContext, useEffect, useState } from 'react';
import type { AppBranding } from '../boot/branding.js';
import { type AuthLoadingScreenProps, LoadingAnimation } from './SplashScreen';

export const BrandingContext = createContext<AppBranding>({ name: '' });

export function BrandLoadingIcon({ brand }: { brand: AppBranding }) {
    if (!brand.loadingIcon) return null;
    return (
        <>
            <img src={brand.loadingIcon.light} alt="" className="vertesia-loading-icon block dark:hidden" />
            <img
                src={brand.loadingIcon.dark ?? brand.loadingIcon.light}
                alt=""
                className="vertesia-loading-icon hidden dark:block"
            />
        </>
    );
}

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
