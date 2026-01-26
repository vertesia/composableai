/**
 * Dynamic Navigation
 *
 * Renders navigation items generated from data bindings.
 */

import React from 'react';
import type { ConditionalSpec } from '@vertesia/common';
import type { DynamicNavigationProps } from './types.js';
import { useBinding } from '../data-binding/hooks.js';

/**
 * Evaluate a conditional spec against data.
 */
function evaluateCondition(
    condition: ConditionalSpec | undefined,
    data: Record<string, unknown>
): boolean {
    if (!condition) return true;

    const { type, field, value } = condition;

    if (!field && type !== 'custom') {
        return true;
    }

    let fieldValue: unknown = undefined;
    if (field) {
        const keys = field.split('.');
        fieldValue = data;
        for (const key of keys) {
            if (fieldValue && typeof fieldValue === 'object') {
                fieldValue = (fieldValue as Record<string, unknown>)[key];
            } else {
                fieldValue = undefined;
                break;
            }
        }
    }

    switch (type) {
        case 'equals':
            return fieldValue === value;
        case 'notEquals':
            return fieldValue !== value;
        case 'isEmpty':
            return fieldValue === undefined || fieldValue === null || fieldValue === '';
        case 'isNotEmpty':
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        default:
            return true;
    }
}

/**
 * Interpolate a string template with data values.
 */
function interpolateString(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
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
 * Get a value from data by key path.
 */
function getDataValue(data: Record<string, unknown>, key: string): unknown {
    const keys = key.split('.');
    let value: unknown = data;
    for (const k of keys) {
        if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[k];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * Check if a path matches an active pattern.
 */
function isPathActive(activePath: string, href: string): boolean {
    if (!activePath || !href) return false;
    return activePath === href || activePath.startsWith(href + '/');
}

/**
 * Dynamic navigation component.
 *
 * Fetches data from a binding and renders navigation items
 * based on a template.
 *
 * @example
 * ```tsx
 * <DynamicNavigation
 *   spec={{
 *     id: 'recent-projects',
 *     title: 'Recent Projects',
 *     dataBinding: {
 *       key: 'recentProjects',
 *       source: 'objectQuery',
 *       objectQuery: { type: 'project', limit: 5 }
 *     },
 *     itemTemplate: {
 *       idKey: 'id',
 *       labelKey: 'name',
 *       iconKey: 'icon',
 *       hrefTemplate: '/projects/{{id}}'
 *     }
 *   }}
 *   activePath={router.pathname}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function DynamicNavigation({
    spec,
    activePath = '',
    sidebarCollapsed,
    context,
    onNavigate,
    className,
}: DynamicNavigationProps) {
    // Fetch data for this dynamic section
    const { data, loading, error } = useBinding<unknown[]>(
        spec.dataBinding,
        context || { route: {} }
    );

    // Check visibility condition
    if (!evaluateCondition(spec.showIf, context?.resolved || {})) {
        return null;
    }

    // Get items (limit if specified)
    const items = Array.isArray(data)
        ? spec.maxItems ? data.slice(0, spec.maxItems) : data
        : [];

    const classNames = [
        'fusion-nav-dynamic',
        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    // Loading state
    if (loading) {
        return (
            <div className={classNames}>
                {spec.title && !sidebarCollapsed && (
                    <div className="fusion-nav-dynamic-header">
                        <span className="fusion-nav-dynamic-title">{spec.title}</span>
                    </div>
                )}
                <div className="fusion-nav-dynamic-loading">
                    <span className="fusion-nav-loading-spinner" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={classNames}>
                {spec.title && !sidebarCollapsed && (
                    <div className="fusion-nav-dynamic-header">
                        <span className="fusion-nav-dynamic-title">{spec.title}</span>
                    </div>
                )}
                <div className="fusion-nav-dynamic-error">
                    Failed to load
                </div>
            </div>
        );
    }

    // Empty state
    if (items.length === 0) {
        if (!spec.emptyMessage) {
            return null;
        }

        return (
            <div className={classNames}>
                {spec.title && !sidebarCollapsed && (
                    <div className="fusion-nav-dynamic-header">
                        <span className="fusion-nav-dynamic-title">{spec.title}</span>
                    </div>
                )}
                <div className="fusion-nav-dynamic-empty">
                    {spec.emptyMessage}
                </div>
            </div>
        );
    }

    // Render items
    return (
        <div className={classNames}>
            {spec.title && !sidebarCollapsed && (
                <div className="fusion-nav-dynamic-header">
                    <span className="fusion-nav-dynamic-title">{spec.title}</span>
                </div>
            )}
            <nav className="fusion-nav-dynamic-items">
                {items.map((item, index) => {
                    const itemData = item as Record<string, unknown>;
                    const id = String(getDataValue(itemData, spec.itemTemplate.idKey) || index);
                    const label = String(getDataValue(itemData, spec.itemTemplate.labelKey) || '');
                    const iconValue = spec.itemTemplate.iconKey
                        ? getDataValue(itemData, spec.itemTemplate.iconKey)
                        : undefined;
                    const iconString: string | null = typeof iconValue === 'string' ? iconValue : null;
                    const href = interpolateString(spec.itemTemplate.hrefTemplate, itemData);
                    const badge = spec.itemTemplate.badgeKey
                        ? getDataValue(itemData, spec.itemTemplate.badgeKey)
                        : undefined;

                    const isActive = isPathActive(activePath, href);

                    const itemClassNames = [
                        'fusion-nav-item',
                        'fusion-nav-link',
                        'fusion-nav-dynamic-item',
                        isActive ? 'fusion-nav-active' : '',
                        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
                    ]
                        .filter(Boolean)
                        .join(' ');

                    const handleClick = (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (onNavigate) {
                            onNavigate(href);
                        }
                    };

                    return (
                        <a
                            key={id}
                            href={href}
                            className={itemClassNames}
                            onClick={handleClick}
                            aria-current={isActive ? 'page' : undefined}
                            title={sidebarCollapsed ? label : undefined}
                        >
                            {iconString && (
                                <span className="fusion-nav-icon">{iconString}</span>
                            )}
                            {!sidebarCollapsed && (
                                <>
                                    <span className="fusion-nav-label">{label}</span>
                                    {badge !== undefined && badge !== null && (
                                        <span className="fusion-nav-badge">{String(badge)}</span>
                                    )}
                                </>
                            )}
                        </a>
                    );
                })}
            </nav>
            {spec.viewAllHref && !sidebarCollapsed && (
                <a
                    href={spec.viewAllHref}
                    className="fusion-nav-dynamic-view-all"
                    onClick={(e) => {
                        e.preventDefault();
                        if (onNavigate) {
                            onNavigate(spec.viewAllHref!);
                        }
                    }}
                >
                    View all
                </a>
            )}
        </div>
    );
}
