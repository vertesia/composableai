/**
 * Context provider for FusionFragment components
 * Provides data and update handlers to nested components
 */
import { type ReactNode, type ReactElement } from 'react';
import type { FusionFragmentContextValue, ChartComponentProps } from '../types.js';
export interface FusionFragmentProviderProps {
    /** Data to display in fragments */
    data: Record<string, unknown>;
    /** Callback when a field is updated (direct mode) */
    onUpdate?: (key: string, value: unknown) => Promise<void>;
    /** Send message to conversation (agent mode) */
    sendMessage?: (message: string) => void;
    /** Chart component to render Vega-Lite charts (injected to avoid circular deps) */
    ChartComponent?: React.ComponentType<ChartComponentProps>;
    /** Artifact run ID for resolving artifact references */
    artifactRunId?: string;
    /** Children components */
    children: ReactNode;
}
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
export declare function FusionFragmentProvider({ data, onUpdate, sendMessage, ChartComponent, artifactRunId, children }: FusionFragmentProviderProps): ReactElement;
/**
 * Hook to access FusionFragment context
 * @throws Error if used outside of FusionFragmentProvider
 */
export declare function useFusionFragmentContext(): FusionFragmentContextValue;
/**
 * Hook to safely access FusionFragment context
 * Returns null if not within a provider (useful for optional context)
 */
export declare function useFusionFragmentContextSafe(): FusionFragmentContextValue | null;
//# sourceMappingURL=FusionFragmentContext.d.ts.map