import { ReactNode, createContext, useContext } from "react";

export interface Tab {
    name: string;
    current?: boolean;
    href?: string;
    label: ReactNode;
    content: ReactNode;
    disabled?: boolean;
}

export interface TabsContextProps {
    tabs: Tab[];
    select: (tab: Tab) => void;
}

export function useTabs() {
    return useContext(TabsContext);
}

const TabsContext = createContext<TabsContextProps>({} as TabsContextProps);

export {
    TabsContext
};
