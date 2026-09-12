import { useUserSession } from '@vertesia/ui/session';
import { AnimatePresence, motion } from 'framer-motion';
import { type ComponentType, type ReactNode, useEffect, useState } from 'react';

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
    const [show, setShow] = useState(true);

    useEffect(() => {
        if (!isLoading) {
            setShow(false);
        }
    }, [isLoading]);

    // The permission gate owns the loading UI once a token is available.
    // Skip the exit animation too, so two loading indicators never overlap.
    if (authToken) return null;

    // Custom screens own the entire page, including their animation and positioning.
    if (Screen) return isLoading ? <Screen loadingIcon={Icon} /> : null;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    style={{ zIndex: 999999, position: 'fixed', inset: 0 }}
                    className="fixed inset-x-0 inset-y-0"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ ease: 'easeIn', duration: 0.5 }}
                >
                    <Presentation loadingIcon={Icon} />
                </motion.div>
            )}
        </AnimatePresence>
    );
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
    const stopColor1 = 'currentColor';
    const stopColor2 = 'currentColor';
    // const stopColor1 = "#4F46E5";
    // const stopColor2 = "#4F46E5";
    return (
        <svg
            width="32"
            height="32"
            className="w-8 h-8 text-info"
            viewBox="0 0 50 50"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Loading"
        >
            <title>Loading</title>
            <defs>
                <linearGradient id="spinner-gradient" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stopColor1} stopOpacity="1" />
                    <stop offset="100%" stopColor={stopColor2} stopOpacity="0" />
                </linearGradient>
            </defs>
            <circle
                cx="25"
                cy="25"
                r="20"
                stroke="url(#spinner-gradient)"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Shared logo motion for full-screen and in-content loading states. */
export function LoadingAnimation({ loadingIcon }: AuthLoadingScreenProps) {
    return (
        <div className="animate-[var(--vertesia-loading-animation,spin_4s_linear_infinite)] motion-reduce:animate-none">
            <div className="animate-[var(--vertesia-loading-pulse-animation,pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite)] motion-reduce:animate-none rounded-full bg-transparent">
                {loadingIcon || <LoadingIcon />}
            </div>
        </div>
    );
}
