/**
 * Application Context
 *
 * React context for sharing application state across components.
 */

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { FusionApplication, FusionPage } from '@vertesia/common';
import type { ApplicationContextValue, MatchedRoute } from './types.js';
import type { ResolutionContext } from '../data-binding/types.js';

/**
 * Context for application state.
 */
export const ApplicationContext = createContext<ApplicationContextValue | null>(null);

/**
 * Hook to access application context.
 * Throws if used outside an ApplicationProvider.
 */
export function useApplicationContext(): ApplicationContextValue {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useApplicationContext must be used within an ApplicationProvider');
    }
    return context;
}

/**
 * Hook to safely access application context.
 * Returns null if used outside an ApplicationProvider.
 */
export function useApplicationContextSafe(): ApplicationContextValue | null {
    return useContext(ApplicationContext);
}

/**
 * Props for ApplicationProvider.
 */
export interface ApplicationProviderProps {
    /** Application definition */
    application: FusionApplication;
    /** Current matched route */
    currentRoute: MatchedRoute | null;
    /** Current page */
    currentPage: FusionPage | null;
    /** Global data */
    globalData: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** User context */
    user?: { id: string; roles?: string[]; permissions?: string[] };
    /** Initial sidebar collapsed state */
    initialSidebarCollapsed?: boolean;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Action handler */
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    /** Refresh global data handler */
    onRefreshGlobalData?: () => Promise<void>;
    /** Children */
    children: React.ReactNode;
}

/**
 * Provider for application context.
 */
export function ApplicationProvider({
    application,
    currentRoute,
    currentPage,
    globalData,
    context,
    user,
    initialSidebarCollapsed = false,
    onNavigate,
    onAction,
    onRefreshGlobalData,
    children,
}: ApplicationProviderProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        initialSidebarCollapsed || application.navigation.settings?.sidebarDefaultCollapsed || false
    );

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

    const triggerAction = useCallback(
        (action: string, config?: Record<string, unknown>) => {
            if (onAction) {
                onAction(action, config);
            }
        },
        [onAction]
    );

    const refreshGlobalData = useCallback(async () => {
        if (onRefreshGlobalData) {
            await onRefreshGlobalData();
        }
    }, [onRefreshGlobalData]);

    const value = useMemo<ApplicationContextValue>(
        () => ({
            application,
            currentRoute,
            currentPage,
            globalData,
            settings: application.settings || {},
            user: user || null,
            context,
            sidebarCollapsed,
            toggleSidebar,
            navigate,
            triggerAction,
            refreshGlobalData,
        }),
        [
            application,
            currentRoute,
            currentPage,
            globalData,
            user,
            context,
            sidebarCollapsed,
            toggleSidebar,
            navigate,
            triggerAction,
            refreshGlobalData,
        ]
    );

    return (
        <ApplicationContext.Provider value={value}>
            {children}
        </ApplicationContext.Provider>
    );
}

/**
 * Hook to get the current route.
 */
export function useCurrentRoute(): MatchedRoute | null {
    const { currentRoute } = useApplicationContext();
    return currentRoute;
}

/**
 * Hook to get the current page.
 */
export function useCurrentPage(): FusionPage | null {
    const { currentPage } = useApplicationContext();
    return currentPage;
}

/**
 * Hook to get global data.
 */
export function useGlobalData(): Record<string, unknown> {
    const { globalData } = useApplicationContext();
    return globalData;
}

/**
 * Hook to get a specific global data value.
 */
export function useGlobalDataValue<T>(key: string): T | undefined {
    const globalData = useGlobalData();
    return globalData[key] as T | undefined;
}

/**
 * Hook to get application settings.
 */
export function useApplicationSettings(): Record<string, unknown> {
    const { settings } = useApplicationContext();
    return settings;
}

/**
 * Hook to get navigation functions.
 */
export function useNavigation() {
    const { navigate, sidebarCollapsed, toggleSidebar } = useApplicationContext();
    return { navigate, sidebarCollapsed, toggleSidebar };
}
