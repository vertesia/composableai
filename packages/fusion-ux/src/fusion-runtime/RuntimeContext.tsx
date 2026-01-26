/**
 * Fusion Runtime React Context
 *
 * React integration for the fusion runtime.
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { FusionApplication } from '@vertesia/common';
import type { FusionRuntimeConfig, FusionRuntimeState, FusionRuntimeContextValue, AnalyticsEvent } from './types.js';
import { FusionRuntime } from './FusionRuntime.js';

/**
 * Runtime context.
 */
export const FusionRuntimeContext = createContext<FusionRuntimeContextValue | null>(null);

/**
 * Props for the runtime provider.
 */
export interface FusionRuntimeProviderProps {
    /** Runtime configuration */
    config: FusionRuntimeConfig;
    /** Application to render */
    application?: FusionApplication;
    /** Application ID to load */
    applicationId?: string;
    /** Initial path */
    initialPath?: string;
    /** User context */
    user?: FusionRuntimeState['user'];
    /** Children to render */
    children: ReactNode;
    /** Loading component */
    loadingComponent?: ReactNode;
    /** Error component */
    errorComponent?: (error: Error) => ReactNode;
}

/**
 * Fusion runtime provider component.
 *
 * Initializes the runtime and provides it to the component tree.
 *
 * @example
 * ```tsx
 * <FusionRuntimeProvider
 *   config={{
 *     apiBaseUrl: '/api',
 *     loadPage: (id) => client.fusion.pages.retrieve(id),
 *   }}
 *   application={app}
 *   user={currentUser}
 * >
 *   <App />
 * </FusionRuntimeProvider>
 * ```
 */
export function FusionRuntimeProvider({
    config,
    application,
    applicationId,
    initialPath,
    user,
    children,
    loadingComponent,
    errorComponent,
}: FusionRuntimeProviderProps) {
    const [runtime] = useState(() => new FusionRuntime(config));
    const [state, setState] = useState<FusionRuntimeState>(runtime.getState());
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize runtime
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const appOrId = application || applicationId;
                if (!appOrId) {
                    throw new Error('Either application or applicationId must be provided');
                }

                await runtime.initialize(appOrId, initialPath);

                if (mounted) {
                    setLoading(false);
                }
            } catch (err) {
                if (mounted) {
                    setError(err as Error);
                    setLoading(false);
                }
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, [runtime, application, applicationId, initialPath]);

    // Subscribe to state changes
    useEffect(() => {
        return runtime.subscribe((newState) => {
            setState(newState);
        });
    }, [runtime]);

    // Update user when it changes
    useEffect(() => {
        runtime.setUser(user || null);
    }, [runtime, user]);

    // Navigation handler
    const navigate = useCallback(
        (path: string, replace = false) => {
            runtime.navigate(path, replace);
        },
        [runtime]
    );

    // Action handler
    const triggerAction = useCallback(
        (action: string, actionConfig?: Record<string, unknown>) => {
            runtime.triggerAction(action, actionConfig);
        },
        [runtime]
    );

    // Track event handler
    const trackEvent = useCallback(
        (event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>) => {
            runtime.trackEvent(event);
        },
        [runtime]
    );

    // Refresh data handler
    const refreshData = useCallback(
        async (key?: string) => {
            await runtime.refreshData(key);
        },
        [runtime]
    );

    // Set user handler
    const setUser = useCallback(
        (newUser: FusionRuntimeState['user']) => {
            runtime.setUser(newUser);
        },
        [runtime]
    );

    // Build context value
    const contextValue: FusionRuntimeContextValue = useMemo(
        () => ({
            state,
            resolver: runtime.getResolver(),
            config: runtime.getConfig(),
            navigate,
            triggerAction,
            trackEvent,
            refreshData,
            setUser,
        }),
        [state, runtime, navigate, triggerAction, trackEvent, refreshData, setUser]
    );

    // Show loading
    if (loading) {
        return (
            <>
                {loadingComponent || (
                    <div className="fusion-runtime-loading">Loading...</div>
                )}
            </>
        );
    }

    // Show error
    if (error) {
        return (
            <>
                {errorComponent ? (
                    errorComponent(error)
                ) : (
                    <div className="fusion-runtime-error">
                        <h2>Failed to initialize</h2>
                        <p>{error.message}</p>
                    </div>
                )}
            </>
        );
    }

    return (
        <FusionRuntimeContext.Provider value={contextValue}>
            {children}
        </FusionRuntimeContext.Provider>
    );
}

/**
 * Hook to access the fusion runtime context.
 *
 * @throws Error if used outside FusionRuntimeProvider
 */
export function useFusionRuntime(): FusionRuntimeContextValue {
    const context = useContext(FusionRuntimeContext);
    if (!context) {
        throw new Error('useFusionRuntime must be used within a FusionRuntimeProvider');
    }
    return context;
}

/**
 * Hook to safely access the fusion runtime context.
 *
 * @returns Context value or null if not in provider
 */
export function useFusionRuntimeSafe(): FusionRuntimeContextValue | null {
    return useContext(FusionRuntimeContext);
}

/**
 * Hook to get runtime state.
 */
export function useRuntimeState(): FusionRuntimeState {
    const { state } = useFusionRuntime();
    return state;
}

/**
 * Hook to get current application.
 */
export function useRuntimeApplication(): FusionApplication | null {
    const { state } = useFusionRuntime();
    return state.application;
}

/**
 * Hook to navigate.
 */
export function useRuntimeNavigation(): (path: string, replace?: boolean) => void {
    const { navigate } = useFusionRuntime();
    return navigate;
}

/**
 * Hook to track events.
 */
export function useAnalytics(): (event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>) => void {
    const { trackEvent } = useFusionRuntime();
    return trackEvent;
}

/**
 * Hook to get and set user.
 */
export function useRuntimeUser(): [
    FusionRuntimeState['user'],
    (user: FusionRuntimeState['user']) => void
] {
    const { state, setUser } = useFusionRuntime();
    return [state.user, setUser];
}
