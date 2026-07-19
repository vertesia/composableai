import type {
    ExecuteViewRequest,
    ViewDisplayConfiguration,
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
