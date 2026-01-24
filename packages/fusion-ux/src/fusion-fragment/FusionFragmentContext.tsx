/**
 * Context provider for FusionFragment components
 * Provides data and update handlers to nested components
 */

import React, { createContext, useContext, useMemo, type ReactNode, type ReactElement } from 'react';
import type { FusionFragmentContextValue } from '../types.js';

const FusionFragmentContext = createContext<FusionFragmentContextValue | null>(null);

export interface FusionFragmentProviderProps {
  /** Data to display in fragments */
  data: Record<string, unknown>;
  /** Callback when a field is updated (direct mode) */
  onUpdate?: (key: string, value: unknown) => Promise<void>;
  /** Send message to conversation (agent mode) */
  sendMessage?: (message: string) => void;
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
  children
}: FusionFragmentProviderProps): ReactElement {
  const value = useMemo<FusionFragmentContextValue>(
    () => ({ data, onUpdate, sendMessage }),
    [data, onUpdate, sendMessage]
  );

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
