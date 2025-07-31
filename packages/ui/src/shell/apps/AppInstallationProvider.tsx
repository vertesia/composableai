import { AppInstallationWithManifest } from "@vertesia/common";
import { createContext, ReactNode } from "react";


export const AppInstallationContext = createContext<AppInstallationWithManifest | null>(null);

export function AppInstallationProvider({ installation, children }: { installation: AppInstallationWithManifest, children: ReactNode }) {
    return (
        <AppInstallationContext.Provider value={installation}>
            {children}
        </AppInstallationContext.Provider>
    )
}
