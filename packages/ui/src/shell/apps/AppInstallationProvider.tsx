import { AppInstallationWithManifest } from "@vertesia/common";
import { createContext, ReactNode, useContext } from "react";


export const AppInstallationContext = createContext<AppInstallationWithManifest | null>(null);

export function AppInstallationProvider({ installation, children }: { installation: AppInstallationWithManifest, children: ReactNode }) {
    return (
        <AppInstallationContext.Provider value={installation}>
            {children}
        </AppInstallationContext.Provider>
    )
}

/**
 * Get the current app installation obejct when called in an app context otheriwse returns null
 */
export function useAppInstallation() {
    return useContext(AppInstallationContext);
}


