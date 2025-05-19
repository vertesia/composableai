import { createContext, useContext } from "react";

interface SidebarContextType {
    isOpen: boolean;
    toggleMobile: (isOpen?: boolean) => void;
    toggleDesktop: (isOpen?: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
    isOpen: false,
    toggleMobile: () => void 0,
    toggleDesktop: () => void 0,
});

export function useSidebarToggle() {
    return useContext(SidebarContext);
}
