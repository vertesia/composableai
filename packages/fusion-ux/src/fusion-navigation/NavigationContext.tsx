/**
 * Navigation Context
 *
 * React context for sharing navigation state across components.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { NavigationContextValue } from './types.js';

/**
 * Context for navigation state.
 */
export const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Hook to access navigation context.
 * Throws if used outside a NavigationProvider.
 */
export function useNavigationContext(): NavigationContextValue {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigationContext must be used within a NavigationProvider');
    }
    return context;
}

/**
 * Hook to safely access navigation context.
 * Returns null if used outside a NavigationProvider.
 */
export function useNavigationContextSafe(): NavigationContextValue | null {
    return useContext(NavigationContext);
}

/**
 * Props for NavigationProvider.
 */
export interface NavigationProviderProps {
    /** Current active path */
    activePath?: string;
    /** Initial sidebar collapsed state */
    initialCollapsed?: boolean;
    /** Resolved data for dynamic navigation */
    data?: Record<string, unknown>;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Children */
    children: React.ReactNode;
}

/**
 * Provider for navigation context.
 */
export function NavigationProvider({
    activePath = '',
    initialCollapsed = false,
    data = {},
    onNavigate,
    children,
}: NavigationProviderProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);

    const navigate = useCallback(
        (href: string, newTab?: boolean) => {
            if (onNavigate) {
                onNavigate(href, newTab);
            }
        },
        [onNavigate]
    );

    const value = useMemo<NavigationContextValue>(
        () => ({
            activePath,
            sidebarCollapsed,
            toggleSidebar,
            navigate,
            data,
        }),
        [activePath, sidebarCollapsed, toggleSidebar, navigate, data]
    );

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    );
}
