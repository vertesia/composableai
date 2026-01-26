/**
 * Sidebar Navigation
 *
 * Renders a sidebar navigation with sections and dynamic items.
 */

import React from 'react';
import type { ConditionalSpec } from '@vertesia/common';
import type { SidebarNavigationProps, NavigationSectionProps } from './types.js';
import { NavigationItem } from './NavigationItem.js';
import { DynamicNavigation } from './DynamicNavigation.js';

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
 * Navigation section component.
 */
export function NavigationSection({
    section,
    activePath = '',
    sidebarCollapsed,
    data = {},
    onNavigate,
    onAction,
    className,
}: NavigationSectionProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(section.collapsed ?? false);

    // Check visibility condition
    if (!evaluateCondition(section.showIf, data)) {
        return null;
    }

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    const classNames = [
        'fusion-nav-section',
        isCollapsed ? 'fusion-nav-section-collapsed' : '',
        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classNames}>
            {section.title && !sidebarCollapsed && (
                <div className="fusion-nav-section-header">
                    <button
                        className="fusion-nav-section-title"
                        onClick={toggleCollapse}
                        aria-expanded={!isCollapsed}
                    >
                        <span>{section.title}</span>
                        <span className="fusion-nav-section-arrow">
                            {isCollapsed ? '▸' : '▾'}
                        </span>
                    </button>
                </div>
            )}
            {!isCollapsed && (
                <nav className="fusion-nav-section-items">
                    {section.items.map((item, index) => (
                        <NavigationItem
                            key={item.type === 'divider' ? `divider-${index}` : (item as { id: string }).id}
                            item={item}
                            activePath={activePath}
                            sidebarCollapsed={sidebarCollapsed}
                            data={data}
                            onNavigate={onNavigate}
                            onAction={onAction}
                        />
                    ))}
                </nav>
            )}
        </div>
    );
}

/**
 * Sidebar navigation component.
 *
 * @example
 * ```tsx
 * <SidebarNavigation
 *   sections={navigation.sidebar}
 *   dynamic={navigation.dynamic}
 *   activePath={router.pathname}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function SidebarNavigation({
    sections,
    dynamic,
    activePath = '',
    collapsed = false,
    onToggleCollapse,
    data = {},
    context,
    onNavigate,
    onAction,
    className,
}: SidebarNavigationProps) {
    const classNames = [
        'fusion-sidebar',
        collapsed ? 'fusion-sidebar-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <aside className={classNames}>
            {/* Collapse toggle */}
            {onToggleCollapse && (
                <button
                    className="fusion-sidebar-toggle"
                    onClick={onToggleCollapse}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <span className="fusion-sidebar-toggle-icon">
                        {collapsed ? '▸' : '◂'}
                    </span>
                </button>
            )}

            {/* Static sections */}
            <div className="fusion-sidebar-content">
                {sections.map((section) => (
                    <NavigationSection
                        key={section.id}
                        section={section}
                        activePath={activePath}
                        sidebarCollapsed={collapsed}
                        data={data}
                        onNavigate={onNavigate}
                        onAction={onAction}
                    />
                ))}

                {/* Dynamic sections */}
                {dynamic?.map((spec) => (
                    <DynamicNavigation
                        key={spec.id}
                        spec={spec}
                        activePath={activePath}
                        sidebarCollapsed={collapsed}
                        context={context}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </aside>
    );
}
