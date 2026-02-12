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
    // Memoize on the individual callback to stay stable even if the caller
    // passes a new wrapper object on every render (e.g. inline {{ resolveStoreUrl }}).
    const value = useMemo<SchemeRouteOverrides>(
        () => ({ resolveStoreUrl: overrides.resolveStoreUrl }),
        [overrides.resolveStoreUrl],
    );
    return createElement(SchemeRouteContext.Provider, { value }, children);
}

export function useSchemeRouteOverrides(): SchemeRouteOverrides | undefined {
    return useContext(SchemeRouteContext);
}
