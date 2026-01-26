/**
 * Fusion Page Context
 *
 * React context for sharing page state across components.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ActionSpec } from '@vertesia/common';
import type { ResolutionContext } from '../data-binding/types.js';
import type { FusionPageContextValue, ContentRendererRegistry, ContentRendererProps } from './types.js';

/**
 * Context for fusion page state.
 */
export const FusionPageContext = createContext<FusionPageContextValue | null>(null);

/**
 * Hook to access fusion page context.
 * Throws if used outside a FusionPageProvider.
 */
export function useFusionPageContext(): FusionPageContextValue {
    const context = useContext(FusionPageContext);
    if (!context) {
        throw new Error('useFusionPageContext must be used within a FusionPageProvider');
    }
    return context;
}

/**
 * Hook to safely access fusion page context.
 * Returns null if used outside a FusionPageProvider.
 */
export function useFusionPageContextSafe(): FusionPageContextValue | null {
    return useContext(FusionPageContext);
}

/**
 * Props for FusionPageProvider.
 */
export interface FusionPageProviderProps {
    /** Resolved data */
    data: Record<string, unknown>;
    /** Resolution context */
    context: ResolutionContext;
    /** Action handler */
    onAction?: (action: ActionSpec, data?: Record<string, unknown>) => void;
    /** Update handler */
    onUpdate?: (key: string, value: unknown) => void;
    /** Navigation handler */
    onNavigate?: (href: string, newTab?: boolean) => void;
    /** Content renderer registry */
    renderers?: ContentRendererRegistry;
    /** Children */
    children: React.ReactNode;
}

/**
 * Provider for fusion page context.
 */
export function FusionPageProvider({
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
    renderers,
    children,
}: FusionPageProviderProps) {
    const value = useMemo<FusionPageContextValue>(
        () => ({
            data,
            context,
            onAction,
            onUpdate,
            onNavigate,
            renderers,
        }),
        [data, context, onAction, onUpdate, onNavigate, renderers]
    );

    return (
        <FusionPageContext.Provider value={value}>
            {children}
        </FusionPageContext.Provider>
    );
}

/**
 * Create a content renderer registry.
 */
export function createContentRendererRegistry(): ContentRendererRegistry {
    const renderers = new Map<string, React.ComponentType<ContentRendererProps>>();

    return {
        get: (type: string) => renderers.get(type),
        register: (type: string, renderer: React.ComponentType<ContentRendererProps>) => {
            renderers.set(type, renderer);
        },
    };
}
