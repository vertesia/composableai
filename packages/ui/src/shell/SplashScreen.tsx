import { Spinner } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import type { ComponentType, ReactNode } from 'react';
import { LOADING_INDICATOR_STYLES } from '../boot/loading.js';

export interface AuthLoadingScreenProps {
    loadingIcon?: ReactNode;
}

interface SplashScreenProps {
    Presentation?: ComponentType<AuthLoadingScreenProps>;
    Screen?: ComponentType<AuthLoadingScreenProps>;
    icon?: ReactNode;
}
export function SplashScreen({ icon: Icon, Screen, Presentation = DefaultAuthLoadingScreen }: SplashScreenProps) {
    const { isLoading, authToken } = useUserSession();
    // Hand off synchronously: an exiting splash must never cover the next view.
    if (authToken || !isLoading) return null;

    // Custom screens own the entire page, including their animation and positioning.
    const LoadingScreen = Screen ?? Presentation;
    return <LoadingScreen loadingIcon={Icon} />;
}

/** Presentation shared by the default shell and configured branding. */
export function DefaultAuthLoadingScreen({
    loadingIcon,
    loadingLabel = 'Loading',
}: AuthLoadingScreenProps & { loadingLabel?: string }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }} role="status" aria-label={loadingLabel}>
            <div
                style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                className="flex w-full h-full items-center justify-center"
            >
                <LoadingAnimation loadingIcon={loadingIcon} />
            </div>
        </div>
    );
}

function LoadingIcon() {
    return <Spinner size="2xl" />;
}

/** Shared logo motion for full-screen and in-content loading states. */
export function LoadingAnimation({ loadingIcon }: AuthLoadingScreenProps) {
    return (
        <div className="vertesia-loading-motion">
            <style>{LOADING_INDICATOR_STYLES}</style>
            {loadingIcon || <LoadingIcon />}
        </div>
    );
}
