/**
 * Navigation Item
 *
 * Renders a single navigation item (link, group, divider, or action).
 */

import React, { useState } from 'react';
import type {
    NavigationActionSpec,
    ConditionalSpec,
    IconSpec,
    BadgeSpec,
} from '@vertesia/common';
import type { NavigationItemProps, NavigationLinkProps, NavigationGroupProps } from './types.js';

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
        case 'contains':
            if (Array.isArray(fieldValue)) return fieldValue.includes(value);
            if (typeof fieldValue === 'string') return fieldValue.includes(String(value));
            return false;
        case 'isEmpty':
            return fieldValue === undefined || fieldValue === null || fieldValue === '';
        case 'isNotEmpty':
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        case 'greaterThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
        case 'lessThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
        default:
            return true;
    }
}

/**
 * Check if a path matches an active pattern.
 */
function isPathActive(activePath: string, href: string, exactMatch?: boolean): boolean {
    if (!activePath || !href) return false;

    if (exactMatch) {
        return activePath === href;
    }

    // Prefix match
    return activePath === href || activePath.startsWith(href + '/');
}

/**
 * Render an icon.
 */
function renderIcon(icon: IconSpec | undefined): React.ReactNode {
    if (!icon) return null;

    switch (icon.type) {
        case 'emoji':
            return <span className="fusion-nav-icon fusion-nav-icon-emoji">{icon.value}</span>;
        case 'lucide':
            return <span className="fusion-nav-icon fusion-nav-icon-lucide" data-icon={icon.value} />;
        case 'heroicons':
            return <span className="fusion-nav-icon fusion-nav-icon-heroicons" data-icon={icon.value} />;
        case 'url':
            return <img className="fusion-nav-icon fusion-nav-icon-image" src={icon.value} alt="" />;
        default:
            return null;
    }
}

/**
 * Render a badge.
 */
function renderBadge(badge: BadgeSpec | undefined, data: Record<string, unknown>): React.ReactNode {
    if (!badge) return null;

    let value: string | number | undefined;

    if (badge.dataKey) {
        const keys = badge.dataKey.split('.');
        let v: unknown = data;
        for (const key of keys) {
            if (v && typeof v === 'object') {
                v = (v as Record<string, unknown>)[key];
            } else {
                v = undefined;
                break;
            }
        }
        value = typeof v === 'number' || typeof v === 'string' ? v : undefined;
    } else {
        value = badge.value;
    }

    if (value === undefined || value === null) return null;
    if (value === 0 && !badge.showZero) return null;

    const displayValue = badge.max && typeof value === 'number' && value > badge.max
        ? `${badge.max}+`
        : value;

    return (
        <span className={`fusion-nav-badge fusion-nav-badge-${badge.variant || 'default'}`}>
            {displayValue}
        </span>
    );
}

/**
 * Navigation link component.
 */
export function NavigationLink({
    item,
    activePath = '',
    level = 0,
    sidebarCollapsed,
    data = {},
    onNavigate,
    className,
}: NavigationLinkProps) {
    const isActive = isPathActive(
        activePath,
        item.activeMatch || item.href,
        item.activeMatchExact
    );

    const handleClick = (e: React.MouseEvent) => {
        if (item.external || item.target === '_blank') {
            // Let browser handle external links
            return;
        }

        e.preventDefault();
        if (onNavigate) {
            // After the check above, target can't be _blank
            onNavigate(item.href, false);
        }
    };

    const classNames = [
        'fusion-nav-item',
        'fusion-nav-link',
        isActive ? 'fusion-nav-active' : '',
        item.disabled ? 'fusion-nav-disabled' : '',
        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <a
            href={item.href}
            className={classNames}
            style={{ paddingLeft: `${(level + 1) * 12}px` }}
            onClick={handleClick}
            target={item.external ? item.target || '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            aria-current={isActive ? 'page' : undefined}
            title={sidebarCollapsed ? item.label : item.tooltip}
        >
            {renderIcon(item.icon)}
            {!sidebarCollapsed && (
                <>
                    <span className="fusion-nav-label">{item.label}</span>
                    {renderBadge(item.badge, data)}
                </>
            )}
        </a>
    );
}

/**
 * Navigation group component.
 */
export function NavigationGroup({
    item,
    activePath = '',
    level = 0,
    sidebarCollapsed,
    data = {},
    onNavigate,
    onAction,
    className,
}: NavigationGroupProps) {
    const [isExpanded, setIsExpanded] = useState(item.defaultExpanded ?? true);

    // Check if any child is active
    const hasActiveChild = item.children.some((child) => {
        if (child.type === 'link') {
            return isPathActive(activePath, child.href, child.activeMatchExact);
        }
        return false;
    });

    const toggleExpanded = () => {
        if (item.collapsible !== false) {
            setIsExpanded(!isExpanded);
        }
    };

    const classNames = [
        'fusion-nav-item',
        'fusion-nav-group',
        isExpanded ? 'fusion-nav-expanded' : 'fusion-nav-collapsed-group',
        hasActiveChild ? 'fusion-nav-has-active' : '',
        item.disabled ? 'fusion-nav-disabled' : '',
        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classNames}>
            <button
                className="fusion-nav-group-header"
                style={{ paddingLeft: `${(level + 1) * 12}px` }}
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                title={sidebarCollapsed ? item.label : item.tooltip}
            >
                {renderIcon(item.icon)}
                {!sidebarCollapsed && (
                    <>
                        <span className="fusion-nav-label">{item.label}</span>
                        {renderBadge(item.badge, data)}
                        <span className="fusion-nav-group-arrow">
                            {isExpanded ? '▾' : '▸'}
                        </span>
                    </>
                )}
            </button>
            {isExpanded && !sidebarCollapsed && (
                <div className="fusion-nav-group-children">
                    {item.children.map((child, index) => (
                        <NavigationItem
                            key={child.type === 'divider' ? `divider-${index}` : (child as { id: string }).id}
                            item={child}
                            activePath={activePath}
                            level={level + 1}
                            sidebarCollapsed={sidebarCollapsed}
                            data={data}
                            onNavigate={onNavigate}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Navigation action component.
 */
function NavigationAction({
    item,
    level = 0,
    sidebarCollapsed,
    data = {},
    onAction,
    className,
}: {
    item: NavigationActionSpec;
    level?: number;
    sidebarCollapsed?: boolean;
    data?: Record<string, unknown>;
    onAction?: (action: string, config?: Record<string, unknown>) => void;
    className?: string;
}) {
    const handleClick = () => {
        if (onAction) {
            onAction(item.action, item.config);
        }
    };

    const classNames = [
        'fusion-nav-item',
        'fusion-nav-action',
        item.disabled ? 'fusion-nav-disabled' : '',
        sidebarCollapsed ? 'fusion-nav-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            className={classNames}
            style={{ paddingLeft: `${(level + 1) * 12}px` }}
            onClick={handleClick}
            disabled={item.disabled}
            title={sidebarCollapsed ? item.label : item.tooltip}
        >
            {renderIcon(item.icon)}
            {!sidebarCollapsed && (
                <>
                    <span className="fusion-nav-label">{item.label}</span>
                    {renderBadge(item.badge, data)}
                </>
            )}
        </button>
    );
}

/**
 * Navigation divider component.
 */
function NavigationDivider({
    label,
    sidebarCollapsed,
}: {
    label?: string;
    sidebarCollapsed?: boolean;
}) {
    if (sidebarCollapsed) {
        return <hr className="fusion-nav-divider fusion-nav-collapsed" />;
    }

    return (
        <div className="fusion-nav-divider">
            {label && <span className="fusion-nav-divider-label">{label}</span>}
            <hr />
        </div>
    );
}

/**
 * Main navigation item component.
 * Dispatches to specific item type renderers.
 */
export function NavigationItem({
    item,
    activePath = '',
    level = 0,
    sidebarCollapsed,
    data = {},
    onNavigate,
    onAction,
    className,
}: NavigationItemProps) {
    // Check visibility condition
    if (item.type !== 'divider' && !evaluateCondition(item.showIf, data)) {
        return null;
    }

    switch (item.type) {
        case 'link':
            return (
                <NavigationLink
                    item={item}
                    activePath={activePath}
                    level={level}
                    sidebarCollapsed={sidebarCollapsed}
                    data={data}
                    onNavigate={onNavigate}
                    className={className}
                />
            );
        case 'group':
            return (
                <NavigationGroup
                    item={item}
                    activePath={activePath}
                    level={level}
                    sidebarCollapsed={sidebarCollapsed}
                    data={data}
                    onNavigate={onNavigate}
                    onAction={onAction}
                    className={className}
                />
            );
        case 'divider':
            return (
                <NavigationDivider
                    label={item.label}
                    sidebarCollapsed={sidebarCollapsed}
                />
            );
        case 'action':
            return (
                <NavigationAction
                    item={item}
                    level={level}
                    sidebarCollapsed={sidebarCollapsed}
                    data={data}
                    onAction={onAction}
                    className={className}
                />
            );
        default:
            return null;
    }
}
