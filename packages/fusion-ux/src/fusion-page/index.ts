/**
 * Fusion Page Module
 *
 * Components for rendering dynamic fusion pages with layouts, regions, and content.
 *
 * @example
 * ```tsx
 * import {
 *   FusionPageRenderer,
 *   FusionPageProvider,
 *   useFusionPageContext,
 * } from '@vertesia/fusion-ux';
 *
 * // Render a complete page with automatic data loading
 * <FusionPageRenderer
 *   page={page}
 *   context={{ route: { id: '123' } }}
 *   onAction={handleAction}
 *   onNavigate={handleNavigate}
 * />
 *
 * // Or provide data externally
 * <FusionPageProvider data={data} context={context}>
 *   <PageLayoutRenderer layout={page.layout} regions={page.regions} />
 * </FusionPageProvider>
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
    FusionPageRendererProps,
    PageLayoutRendererProps,
    RegionRendererProps,
    ContentRendererProps,
    ActionButtonProps,
    BreadcrumbsRendererProps,
    PageHeaderProps,
    ContentRendererRegistry,
    FusionPageContextValue,
} from './types.js';

// Context and Provider
export {
    FusionPageContext,
    FusionPageProvider,
    useFusionPageContext,
    useFusionPageContextSafe,
    createContentRendererRegistry,
    type FusionPageProviderProps,
} from './FusionPageContext.js';

// Main Page Renderer
export {
    FusionPageRenderer,
    FusionPageWithData,
} from './FusionPageRenderer.js';

// Layout Renderer
export { PageLayoutRenderer } from './PageLayoutRenderer.js';

// Region Renderer
export { RegionRenderer } from './RegionRenderer.js';

// Content Renderer
export { ContentRenderer } from './ContentRenderer.js';

// Page Header
export { PageHeader } from './PageHeader.js';

// Action Button
export { ActionButton, executeAction } from './ActionButton.js';
