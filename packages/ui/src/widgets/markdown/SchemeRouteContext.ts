import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";

export interface SchemeRouteOverrides {
    /** Override the route for store: and document:// object links. Receives the object ID, returns the href. */
    resolveStoreUrl?: (objectId: string) => string;
}

const SchemeRouteContext = createContext<SchemeRouteOverrides | undefined>(undefined);

export interface SchemeRouteProviderProps {
    overrides: SchemeRouteOverrides;
    children: ReactNode;
}

export function SchemeRouteProvider({ overrides, children }: SchemeRouteProviderProps) {
    const value = useMemo(() => overrides, [overrides]);
    return createElement(SchemeRouteContext.Provider, { value }, children);
}

export function useSchemeRouteOverrides(): SchemeRouteOverrides | undefined {
    return useContext(SchemeRouteContext);
}
