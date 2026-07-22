import type {
    ExecuteViewRequest,
    ViewActionConfiguration,
    ViewDisplayConfiguration,
    ViewDropConfiguration,
    ViewExecutionDefinition,
    ViewExecutionResult,
    ViewHit,
    ViewNavigationItem,
    ViewNavigationResult,
    ViewResultMedia,
    ViewSearchConfiguration,
} from '@vertesia/common';
import type { ComponentType } from 'react';

export interface ViewSearchRendererProps {
    configuration: ViewSearchConfiguration;
    query: string;
    keyTerms: Record<string, string[]>;
    isLoading: boolean;
    onQueryChange: (query: string) => void;
    onKeyTermsChange: (id: string, values: string[]) => void;
    onSubmit: () => void;
}

export interface ViewNavigationRendererProps {
    configuration: ViewNavigationItem;
    result: ViewNavigationResult;
    isLoading: boolean;
    onChange: (values: string[]) => void;
    /** Apply a server-side node filter for navigation sources that support it. */
    onQueryChange?: (query: string) => void;
}

export interface ViewResultsRendererProps {
    configuration: ViewDisplayConfiguration;
    definition: ViewExecutionDefinition;
    request: ExecuteViewRequest;
    result: ViewExecutionResult;
    isLoading: boolean;
    onSortChange?: (sort: string) => void;
    onOpenHit?: (hit: ViewHit) => void;
    resolveMedia?: ViewMediaResolver;
    selection?: ViewSelectionController;
}

export interface ViewSelectionController {
    mode: 'single' | 'multiple';
    selectAll: boolean;
    selectedIds: string[];
    selectedHits: ViewHit[];
    isSelected: (id: string) => boolean;
    toggle: (hit: ViewHit, selected: boolean, options?: { page?: ViewHit[]; range?: boolean }) => void;
    togglePage: (hits: ViewHit[], selected: boolean) => void;
    clear: () => void;
}

export interface ViewActionContext {
    action: ViewActionConfiguration;
    hits: ViewHit[];
    definition: ViewExecutionDefinition;
    request: ExecuteViewRequest;
    result: ViewExecutionResult;
    refresh: () => Promise<void>;
    clearSelection: () => void;
}

export interface ViewActionContribution {
    run: (context: ViewActionContext) => void | Promise<void>;
    isAvailable?: (context: Omit<ViewActionContext, 'action' | 'hits'>) => boolean;
}

export interface ViewDropContext {
    configuration?: ViewDropConfiguration;
    files: File[];
    definition: ViewExecutionDefinition;
    request: ExecuteViewRequest;
    result: ViewExecutionResult;
    refresh: () => Promise<void>;
}

export interface ViewDropContribution {
    run: (context: ViewDropContext) => void | Promise<void>;
}

export interface ViewExperienceContributions {
    actions?: Record<string, ViewActionContribution>;
    /** Code-only drop behavior. When present it overrides the JSON-configured upload target. */
    drop?: ViewDropContribution;
}

export interface ViewExperienceRenderers {
    search?: Record<string, ComponentType<ViewSearchRendererProps>>;
    navigation?: Record<string, ComponentType<ViewNavigationRendererProps>>;
    results?: Record<string, ComponentType<ViewResultsRendererProps>>;
}

export type ViewExecutor = (request: ExecuteViewRequest) => Promise<ViewExecutionResult>;

/**
 * Resolves media that is not already an HTTP URL, such as a signed content
 * thumbnail. Embedded apps can provide their own resolver.
 */
export type ViewMediaResolver = (
    hit: ViewHit,
    media: ViewResultMedia,
) => string | undefined | Promise<string | undefined>;
