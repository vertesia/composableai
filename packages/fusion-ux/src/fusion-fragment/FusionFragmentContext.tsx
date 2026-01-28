/**
 * Context provider for FusionFragment components
 * Provides data and update handlers to nested components
 */

import { createContext, useContext, useMemo, type ReactNode, type ReactElement } from 'react';
import type { FusionFragmentContextValue, ChartComponentProps } from '../types.js';

const FusionFragmentContext = createContext<FusionFragmentContextValue | null>(null);

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
export function FusionFragmentProvider({
  data,
  onUpdate,
  sendMessage,
  ChartComponent,
  artifactRunId,
  children
}: FusionFragmentProviderProps): ReactElement {
  const value = useMemo<FusionFragmentContextValue>(
    () => ({ data, onUpdate, sendMessage, ChartComponent, artifactRunId }),
    [data, onUpdate, sendMessage, ChartComponent, artifactRunId]
  );

  // Debug logging
  console.log('[FusionFragmentProvider] Created with:', {
    hasData: !!data,
    dataKeys: data ? Object.keys(data) : [],
    hasChartComponent: !!ChartComponent,
    artifactRunId,
  });

  return (
    <FusionFragmentContext.Provider value={value}>
      {children}
    </FusionFragmentContext.Provider>
  );
}

/**
 * Hook to access FusionFragment context
 * @throws Error if used outside of FusionFragmentProvider
 */
export function useFusionFragmentContext(): FusionFragmentContextValue {
  const context = useContext(FusionFragmentContext);

  if (!context) {
    throw new Error(
      'useFusionFragmentContext must be used within a FusionFragmentProvider'
    );
  }

  return context;
}

/**
 * Hook to safely access FusionFragment context
 * Returns null if not within a provider (useful for optional context)
 */
export function useFusionFragmentContextSafe(): FusionFragmentContextValue | null {
  return useContext(FusionFragmentContext);
}
