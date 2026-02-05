import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Context provider for FusionFragment components
 * Provides data and update handlers to nested components
 */
import { createContext, useContext, useMemo } from 'react';
const FusionFragmentContext = createContext(null);
/**
 * Provider component that supplies data and update handlers
 * to FusionFragment components via context
 *
 * @example
 * ```tsx
 * <FusionFragmentProvider
 *   data={fund.parameters}
 *   onUpdate={async (key, value) => {
 *     await api.funds.updateParameters(fundId, { [key]: value });
 *   }}
 * >
 *   <MarkdownRenderer content={agentResponse} />
 * </FusionFragmentProvider>
 * ```
 */
export function FusionFragmentProvider({ data, onUpdate, sendMessage, ChartComponent, artifactRunId, children }) {
    const value = useMemo(() => ({ data, onUpdate, sendMessage, ChartComponent, artifactRunId }), [data, onUpdate, sendMessage, ChartComponent, artifactRunId]);
    // Debug logging
    console.log('[FusionFragmentProvider] Created with:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasChartComponent: !!ChartComponent,
        artifactRunId,
    });
    return (_jsx(FusionFragmentContext.Provider, { value: value, children: children }));
}
/**
 * Hook to access FusionFragment context
 * @throws Error if used outside of FusionFragmentProvider
 */
export function useFusionFragmentContext() {
    const context = useContext(FusionFragmentContext);
    if (!context) {
        throw new Error('useFusionFragmentContext must be used within a FusionFragmentProvider');
    }
    return context;
}
/**
 * Hook to safely access FusionFragment context
 * Returns null if not within a provider (useful for optional context)
 */
export function useFusionFragmentContextSafe() {
    return useContext(FusionFragmentContext);
}
//# sourceMappingURL=FusionFragmentContext.js.map