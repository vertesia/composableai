import { ThemeProvider, ToastProvider } from "@vertesia/ui/core";
import { UserPermissionProvider } from "@vertesia/ui/features";
import { UserSessionProvider } from "@vertesia/ui/session";
import { SplashScreen } from "./SplashScreen";
import { SigninScreen } from "./login/SigninScreen";


interface VertesiaShellProps {
    children: React.ReactNode;
    lightLogo?: string;
    darkLogo?: string;
}
export function VertesiaShell({ children, lightLogo, darkLogo }: VertesiaShellProps) {
    return (
        <ToastProvider>
            <UserSessionProvider>
                <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                    <SplashScreen />
                    <SigninScreen allowedPrefix="/shared/" lightLogo={lightLogo} darkLogo={darkLogo} />
                    <UserPermissionProvider>
                        {children}
                    </UserPermissionProvider>
                </ThemeProvider>
            </UserSessionProvider>
        </ToastProvider>
    )
}