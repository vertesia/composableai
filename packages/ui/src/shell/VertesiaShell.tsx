import { ThemeProvider, ToastProvider } from "@vertesia/ui/core";
import { UserPermissionProvider, TypeRegistryProvider } from "@vertesia/ui/features";
import { UserSessionProvider } from "@vertesia/ui/session";
import { SplashScreen } from "./SplashScreen";
import { SigninScreen } from "./login/SigninScreen";
import { ReactNode } from "react";


interface VertesiaShellProps {
    children: React.ReactNode;
    lightLogo?: string;
    darkLogo?: string;
    loadingIcon?: ReactNode;
    loadOnboardingStatus?: boolean;
    preserveSignInPath?: boolean;
}
export function VertesiaShell({ children, lightLogo, darkLogo, loadingIcon, loadOnboardingStatus, preserveSignInPath }: VertesiaShellProps) {
    return (
        <ToastProvider>
            <UserSessionProvider loadOnboardingStatus={loadOnboardingStatus}>
                <TypeRegistryProvider>
                    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                        <SplashScreen icon={loadingIcon} />
                        <SigninScreen
                            allowedPrefix="/shared/"
                            darkLogo={darkLogo}
                            lightLogo={lightLogo}
                            preservePath={preserveSignInPath}
                        />
                        <UserPermissionProvider>
                            {children}
                        </UserPermissionProvider>
                    </ThemeProvider>
                </TypeRegistryProvider>
            </UserSessionProvider>
        </ToastProvider>
    )
}
