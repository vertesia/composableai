/**
 * Region Renderer
 *
 * Renders a single page region containing multiple content blocks.
 */

import React from 'react';
import type { PageRegionSpec } from '@vertesia/common';
import type { RegionRendererProps } from './types.js';
import { ContentRenderer } from './ContentRenderer.js';

/**
 * Check if a condition is met.
 */
function evaluateCondition(
    condition: NonNullable<PageRegionSpec['condition']>,
    data: Record<string, unknown>
): boolean {
    const { field, operator, value } = condition;

    // Get the field value from data
    const keys = field.split('.');
    let fieldValue: unknown = data;
    for (const key of keys) {
        if (fieldValue && typeof fieldValue === 'object') {
            fieldValue = (fieldValue as Record<string, unknown>)[key];
        } else {
            fieldValue = undefined;
            break;
        }
    }

    // Evaluate condition
    switch (operator) {
        case 'equals':
            return fieldValue === value;
        case 'notEquals':
            return fieldValue !== value;
        case 'contains':
            if (Array.isArray(fieldValue)) {
                return fieldValue.includes(value);
            }
            if (typeof fieldValue === 'string') {
                return fieldValue.includes(String(value));
            }
            return false;
        case 'exists':
            return fieldValue !== undefined && fieldValue !== null;
        case 'notExists':
            return fieldValue === undefined || fieldValue === null;
        case 'gt':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
        case 'gte':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
        case 'lt':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
        case 'lte':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
        default:
            return true;
    }
}

/**
 * Region renderer component.
 *
 * Renders a region with its title, description, and content blocks.
 * Supports conditional rendering based on data values.
 *
 * @example
 * ```tsx
 * <RegionRenderer
 *   region={{
 *     id: 'customer-info',
 *     slot: 'main',
 *     title: 'Customer Information',
 *     content: [
 *       { type: 'fragment', template: customerTemplate }
 *     ]
 *   }}
 *   data={pageData}
 *   context={context}
 * />
 * ```
 */
export function RegionRenderer({
    region,
    data,
    context,
    className,
    onAction,
    onUpdate,
    onNavigate,
}: RegionRendererProps) {
    // Apply collapsible behavior (hooks must be called unconditionally)
    const [isCollapsed, setIsCollapsed] = React.useState(
        region.collapsible?.defaultCollapsed ?? false
    );

    const toggleCollapse = () => {
        if (region.collapsible?.enabled) {
            setIsCollapsed(!isCollapsed);
        }
    };

    // Check conditional rendering (after hooks)
    if (region.condition) {
        const shouldRender = evaluateCondition(region.condition, data);
        if (!shouldRender) {
            return null;
        }
    }

    // Build class names
    const classNames = [
        'fusion-region',
        region.id ? `fusion-region-${region.id}` : '',
        region.slot ? `fusion-region-slot-${region.slot}` : '',
        region.collapsible?.enabled ? 'fusion-region-collapsible' : '',
        isCollapsed ? 'fusion-region-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    // Apply custom styles
    const style: React.CSSProperties = {};
    if (region.style?.padding) {
        style.padding = region.style.padding;
    }
    if (region.style?.background) {
        style.background = region.style.background;
    }
    if (region.style?.border) {
        style.border = region.style.border;
    }
    if (region.style?.borderRadius) {
        style.borderRadius = region.style.borderRadius;
    }

    return (
        <section
            className={classNames}
            style={Object.keys(style).length > 0 ? style : undefined}
            aria-labelledby={region.title ? `${region.id}-title` : undefined}
        >
            {/* Region Header */}
            {(region.title || region.collapsible?.enabled) && (
                <header className="fusion-region-header">
                    {region.collapsible?.enabled ? (
                        <button
                            className="fusion-region-header-toggle"
                            onClick={toggleCollapse}
                            aria-expanded={!isCollapsed}
                        >
                            {region.title && (
                                <h3
                                    id={`${region.id}-title`}
                                    className="fusion-region-title"
                                >
                                    {region.title}
                                </h3>
                            )}
                            <span className="fusion-region-collapse-icon">
                                {isCollapsed ? '▸' : '▾'}
                            </span>
                        </button>
                    ) : (
                        region.title && (
                            <h3
                                id={`${region.id}-title`}
                                className="fusion-region-title"
                            >
                                {region.title}
                            </h3>
                        )
                    )}
                    {region.description && !isCollapsed && (
                        <p className="fusion-region-description">{region.description}</p>
                    )}
                </header>
            )}

            {/* Region Content */}
            {!isCollapsed && (
                <div className="fusion-region-content">
                    {region.content.map((contentSpec, index) => (
                        <ContentRenderer
                            key={contentSpec.id || `content-${index}`}
                            content={contentSpec}
                            data={data}
                            context={context}
                            onAction={onAction}
                            onUpdate={onUpdate}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
