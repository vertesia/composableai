/**
 * Fusion Runtime
 *
 * Main runtime class for initializing and managing fusion applications.
 */

import type { FusionApplication, FusionPage } from '@vertesia/common';
import type {
    FusionRuntimeConfig,
    FusionRuntimeState,
    AnalyticsEvent,
    PrefetchOptions,
    PrefetchResult,
} from './types.js';
import type { DataBindingResolver, ResolutionContext } from '../data-binding/types.js';
import { createDataBindingResolver } from '../data-binding/resolver.js';

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fusion Runtime class.
 *
 * Coordinates initialization, data loading, navigation, and analytics
 * for fusion applications.
 *
 * @example
 * ```ts
 * const runtime = new FusionRuntime({
 *   apiBaseUrl: '/api',
 *   loadPage: (id) => client.fusion.pages.retrieve(id),
 *   loadApplication: (id) => client.fusion.applications.retrieve(id),
 * });
 *
 * await runtime.initialize(applicationId);
 *
 * // Navigate
 * runtime.navigate('/dashboard');
 *
 * // Track events
 * runtime.trackEvent({ type: 'custom', name: 'button_click' });
 * ```
 */
export class FusionRuntime {
    private config: FusionRuntimeConfig;
    private state: FusionRuntimeState;
    private resolver: DataBindingResolver | null = null;
    private listeners: Set<(state: FusionRuntimeState) => void> = new Set();

    constructor(config: FusionRuntimeConfig = {}) {
        this.config = config;
        this.state = {
            initialized: false,
            application: null,
            currentPage: null,
            currentPath: '/',
            globalData: {},
            user: null,
            sessionId: generateSessionId(),
        };
    }

    /**
     * Initialize the runtime with an application.
     */
    async initialize(
        applicationOrId: FusionApplication | string,
        initialPath?: string
    ): Promise<void> {
        try {
            // Load application if ID provided
            let application: FusionApplication;
            if (typeof applicationOrId === 'string') {
                if (!this.config.loadApplication) {
                    throw new Error('loadApplication function required to load by ID');
                }
                application = await this.config.loadApplication(applicationOrId);
            } else {
                application = applicationOrId;
            }

            // Create resolver
            this.resolver = this.createResolver();

            // Update state
            this.updateState({
                initialized: true,
                application,
                currentPath: initialPath || application.defaultRoute,
            });

            // Load global data
            await this.loadGlobalData();

            // Track initialization
            this.trackEvent({
                type: 'page_view',
                name: 'app_initialized',
                path: this.state.currentPath,
            });

            if (this.config.debug) {
                console.warn('[FusionRuntime] Initialized', {
                    appId: application.id,
                    path: this.state.currentPath,
                });
            }
        } catch (error) {
            this.handleError(error as Error, 'initialize');
            throw error;
        }
    }

    /**
     * Create a data binding resolver with the current config.
     */
    private createResolver(): DataBindingResolver | null {
        if (!this.config.dataFetchers) {
            return null;
        }

        return createDataBindingResolver({
            fetchers: this.config.dataFetchers,
            ...this.config.resolverConfig,
        });
    }

    /**
     * Load global data sources from the application.
     */
    private async loadGlobalData(): Promise<void> {
        if (!this.state.application || !this.resolver) {
            return;
        }

        const sources = this.state.application.globalDataSources?.filter(
            (s) => s.prefetch !== false
        );

        if (!sources || sources.length === 0) {
            return;
        }

        const context = this.buildContext();
        const bindings = sources.map((s) => s.binding);

        const result = await this.resolver.resolveAll(bindings, context);

        if (!result.success && result.errors.length > 0) {
            console.error('[FusionRuntime] Global data errors:', result.errors);
        }

        this.updateState({ globalData: result.data });
    }

    /**
     * Build resolution context.
     */
    private buildContext(): ResolutionContext {
        return {
            route: {},
            settings: this.state.application?.settings || {},
            user: this.state.user || undefined,
            resolved: this.state.globalData,
        };
    }

    /**
     * Navigate to a path.
     */
    navigate(path: string, replace = false): void {
        if (!this.state.initialized) {
            console.warn('[FusionRuntime] Cannot navigate before initialization');
            return;
        }

        const previousPath = this.state.currentPath;

        this.updateState({ currentPath: path });

        // Track navigation
        this.trackEvent({
            type: 'navigation',
            name: 'navigate',
            path,
            properties: { from: previousPath, replace },
        });

        if (this.config.debug) {
            console.warn('[FusionRuntime] Navigate', { from: previousPath, to: path, replace });
        }
    }

    /**
     * Trigger an action.
     */
    triggerAction(action: string, actionConfig?: Record<string, unknown>): void {
        this.trackEvent({
            type: 'action',
            name: action,
            properties: actionConfig,
            path: this.state.currentPath,
        });

        if (this.config.debug) {
            console.warn('[FusionRuntime] Action triggered', { action, config: actionConfig });
        }
    }

    /**
     * Track an analytics event.
     */
    trackEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'sessionId'>): void {
        const fullEvent: AnalyticsEvent = {
            ...event,
            timestamp: Date.now(),
            sessionId: this.state.sessionId,
            userId: this.state.user?.id,
        };

        if (this.config.onAnalyticsEvent) {
            try {
                this.config.onAnalyticsEvent(fullEvent);
            } catch (error) {
                console.error('[FusionRuntime] Analytics error:', error);
            }
        }
    }

    /**
     * Prefetch data for routes or pages.
     */
    async prefetch(options: PrefetchOptions): Promise<PrefetchResult> {
        if (!this.resolver) {
            return { success: false, data: {}, errors: [{ key: '*', error: 'Not initialized' }] };
        }

        // Convert unknown context values to strings for route params
        const routeParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(options.context)) {
            routeParams[key] = String(value);
        }

        const context: ResolutionContext = {
            ...this.buildContext(),
            route: routeParams,
        };

        try {
            const result = await this.resolver.resolveAll(options.bindings, context);

            this.trackEvent({
                type: 'data_load',
                name: 'prefetch',
                properties: { keys: Object.keys(result.data), success: result.success },
            });

            return {
                success: result.success,
                data: result.data,
                errors: result.errors.length > 0 ? result.errors : undefined,
            };
        } catch (error) {
            return {
                success: false,
                data: {},
                errors: [{ key: '*', error: (error as Error).message }],
            };
        }
    }

    /**
     * Refresh data.
     */
    async refreshData(_key?: string): Promise<void> {
        if (!this.resolver) {
            return;
        }

        // Reload global data
        await this.loadGlobalData();
    }

    /**
     * Set user context.
     */
    setUser(user: FusionRuntimeState['user']): void {
        this.updateState({ user });

        if (user) {
            this.trackEvent({
                type: 'custom',
                name: 'user_set',
                properties: { userId: user.id, roles: user.roles },
            });
        }
    }

    /**
     * Set current page.
     */
    setCurrentPage(page: FusionPage | null): void {
        this.updateState({ currentPage: page });
    }

    /**
     * Load a page by ID.
     */
    async loadPage(pageId: string): Promise<FusionPage> {
        if (!this.config.loadPage) {
            throw new Error('loadPage function not configured');
        }

        const page = await this.config.loadPage(pageId);
        this.setCurrentPage(page);

        return page;
    }

    /**
     * Get current state.
     */
    getState(): Readonly<FusionRuntimeState> {
        return { ...this.state };
    }

    /**
     * Get resolver.
     */
    getResolver(): DataBindingResolver | null {
        return this.resolver;
    }

    /**
     * Get configuration.
     */
    getConfig(): Readonly<FusionRuntimeConfig> {
        return { ...this.config };
    }

    /**
     * Subscribe to state changes.
     */
    subscribe(listener: (state: FusionRuntimeState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Update state and notify listeners.
     */
    private updateState(partial: Partial<FusionRuntimeState>): void {
        this.state = { ...this.state, ...partial };

        // Notify listeners
        this.listeners.forEach((listener) => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('[FusionRuntime] Listener error:', error);
            }
        });
    }

    /**
     * Handle errors.
     */
    private handleError(error: Error, context?: string): void {
        this.trackEvent({
            type: 'error',
            name: error.message,
            properties: { context, stack: error.stack },
            path: this.state.currentPath,
        });

        if (this.config.onError) {
            this.config.onError(error, context);
        }

        if (this.config.debug) {
            console.error('[FusionRuntime] Error:', context, error);
        }
    }

    /**
     * Destroy the runtime.
     */
    destroy(): void {
        this.listeners.clear();
        this.resolver = null;
        this.state = {
            initialized: false,
            application: null,
            currentPage: null,
            currentPath: '/',
            globalData: {},
            user: null,
            sessionId: this.state.sessionId,
        };
    }
}

/**
 * Create a fusion runtime instance.
 */
export function createFusionRuntime(config: FusionRuntimeConfig = {}): FusionRuntime {
    return new FusionRuntime(config);
}
