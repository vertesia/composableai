/**
 * Fusion Runtime Module
 *
 * Provides runtime initialization, server-side utilities, and React integration
 * for fusion applications.
 */

// Types
export type {
    FetchFunction,
    FusionRuntimeConfig,
    AnalyticsEventType,
    AnalyticsEvent,
    FusionRuntimeState,
    SSRResult,
    SSRHeadElements,
    SSRContext,
    HydrationData,
    FusionRuntimeContextValue,
    PrefetchOptions,
    PrefetchResult,
} from './types.js';

// Runtime class
export { FusionRuntime, createFusionRuntime } from './FusionRuntime.js';

// React context and hooks
export {
    FusionRuntimeContext,
    FusionRuntimeProvider,
    useFusionRuntime,
    useFusionRuntimeSafe,
    useRuntimeState,
    useRuntimeApplication,
    useRuntimeNavigation,
    useAnalytics,
    useRuntimeUser,
    type FusionRuntimeProviderProps,
} from './RuntimeContext.js';

// Server utilities
export {
    loadServerData,
    generateHeadElements,
    createHydrationData,
    serializeHydrationData,
    generateHydrationScript,
    parseHydrationData,
    createServerFetchers,
    type ServerLoadOptions,
    type ServerLoadResult,
} from './server.js';
