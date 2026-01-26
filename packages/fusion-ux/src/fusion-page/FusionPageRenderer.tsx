/**
 * Fusion Page Renderer
 *
 * Main component for rendering a complete fusion page.
 * Handles data loading, layout rendering, and event propagation.
 */

import type { FusionPageRendererProps } from './types.js';
import type { ResolutionContext } from '../data-binding/types.js';
import { usePageData } from '../data-binding/hooks.js';
import { FusionPageProvider } from './FusionPageContext.js';
import { PageLayoutRenderer } from './PageLayoutRenderer.js';
import { PageHeader } from './PageHeader.js';

/**
 * Default loading component.
 */
function DefaultLoading() {
    return (
        <div className="fusion-page-loading">
            <div className="fusion-page-loading-spinner" />
            <span>Loading...</span>
        </div>
    );
}

/**
 * Default error component.
 */
function DefaultError({ message }: { message: string }) {
    return (
        <div className="fusion-page-error">
            <span className="fusion-page-error-icon">⚠</span>
            <span className="fusion-page-error-message">{message}</span>
        </div>
    );
}

/**
 * Resolve title with data interpolation.
 */
function resolveTitle(title: string, data: Record<string, unknown>): string {
    return title.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const keys = key.trim().split('.');
        let value: unknown = data;
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = (value as Record<string, unknown>)[k];
            } else {
                return `{{${key}}}`;
            }
        }
        return String(value ?? `{{${key}}}`);
    });
}

/**
 * Main fusion page renderer component.
 *
 * @example
 * ```tsx
 * <FusionPageRenderer
 *   page={page}
 *   context={{ route: { customerId: '123' } }}
 *   onAction={(action, data) => handleAction(action, data)}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function FusionPageRenderer({
    page,
    data: providedData,
    context: providedContext,
    autoLoadData = true,
    loadingComponent,
    errorComponent,
    className,
    onAction,
    onUpdate,
    onNavigate,
}: FusionPageRendererProps) {
    // Build context from props
    const context: ResolutionContext = providedContext || { route: {} };

    // Use internal data loading if no data provided and autoLoadData is true
    const shouldLoadData = autoLoadData && !providedData && page.dataBindings?.length;
    const {
        data: loadedData,
        loading,
        error,
    } = usePageData(
        shouldLoadData ? page.dataBindings || [] : [],
        context,
        { enabled: !!shouldLoadData }
    );

    // Use provided data or loaded data
    const data = providedData || loadedData;

    // Show loading state
    if (shouldLoadData && loading) {
        return <>{loadingComponent || <DefaultLoading />}</>;
    }

    // Show error state
    if (shouldLoadData && error) {
        const errorNode = errorComponent
            ? errorComponent(error)
            : <DefaultError message={error} />;
        return <>{errorNode}</>;
    }

    // Resolve dynamic title
    const resolvedTitle = resolveTitle(page.title, data);

    // Build page header props
    const headerProps = {
        title: resolvedTitle,
        description: page.description,
        icon: page.icon,
        actions: page.actions,
        breadcrumbs: page.breadcrumbs,
        data,
        context,
        onAction,
        onNavigate,
    };

    return (
        <FusionPageProvider
            data={data}
            context={context}
            onAction={onAction}
            onUpdate={onUpdate}
            onNavigate={onNavigate}
        >
            <div className={`fusion-page ${className || ''}`}>
                {/* Page Header */}
                {(page.title || page.actions?.length || page.breadcrumbs?.length) && (
                    <PageHeader {...headerProps} />
                )}

                {/* Page Layout and Regions */}
                {page.layout && page.regions && (
                    <PageLayoutRenderer
                        layout={page.layout}
                        regions={page.regions}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                )}
            </div>
        </FusionPageProvider>
    );
}

/**
 * Wrapper that provides data externally (for use with custom data loading).
 */
export function FusionPageWithData({
    page,
    data,
    context,
    ...props
}: Omit<FusionPageRendererProps, 'autoLoadData'> & {
    data: Record<string, unknown>;
}) {
    return (
        <FusionPageRenderer
            page={page}
            data={data}
            context={context}
            autoLoadData={false}
            {...props}
        />
    );
}
