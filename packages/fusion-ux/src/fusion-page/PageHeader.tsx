/**
 * Page Header
 *
 * Renders the page header including title, description, breadcrumbs, and actions.
 */

import React from 'react';
import type { BreadcrumbSpec, IconSpec } from '@vertesia/common';
import type { PageHeaderProps } from './types.js';
import { ActionButton } from './ActionButton.js';

/**
 * Render an icon based on its type.
 */
function renderIcon(icon: IconSpec): React.ReactNode {
    switch (icon.type) {
        case 'emoji':
            return <span className="fusion-icon fusion-icon-emoji">{icon.value}</span>;
        case 'lucide':
            // Lucide icons should be rendered by the application
            return <span className="fusion-icon fusion-icon-lucide" data-icon={icon.value} />;
        case 'url':
            return <img className="fusion-icon fusion-icon-image" src={icon.value} alt="" />;
        default:
            return null;
    }
}

/**
 * Get a value from data by key path.
 */
function getDataValue(data: Record<string, unknown>, key: string): string {
    const keys = key.split('.');
    let value: unknown = data;
    for (const k of keys) {
        if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[k];
        } else {
            return '';
        }
    }
    return String(value ?? '');
}

/**
 * Breadcrumbs renderer component.
 */
function Breadcrumbs({
    items,
    data,
    onNavigate,
}: {
    items: BreadcrumbSpec[];
    data: Record<string, unknown>;
    onNavigate?: (href: string) => void;
}) {
    return (
        <nav className="fusion-breadcrumbs" aria-label="Breadcrumb">
            <ol className="fusion-breadcrumbs-list">
                {items.map((item, index) => {
                    const label = item.labelKey
                        ? getDataValue(data, item.labelKey)
                        : item.label || '';
                    const isLast = index === items.length - 1;

                    return (
                        <li key={index} className="fusion-breadcrumbs-item">
                            {item.href && !isLast ? (
                                <a
                                    href={item.href}
                                    className="fusion-breadcrumbs-link"
                                    onClick={(e) => {
                                        if (onNavigate) {
                                            e.preventDefault();
                                            onNavigate(item.href!);
                                        }
                                    }}
                                >
                                    {item.icon && renderIcon(item.icon)}
                                    <span>{label}</span>
                                </a>
                            ) : (
                                <span
                                    className="fusion-breadcrumbs-current"
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.icon && renderIcon(item.icon)}
                                    <span>{label}</span>
                                </span>
                            )}
                            {!isLast && (
                                <span className="fusion-breadcrumbs-separator" aria-hidden="true">
                                    /
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/**
 * Page header component.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Customer Details"
 *   description="View and manage customer information"
 *   icon={{ type: 'emoji', value: '👤' }}
 *   breadcrumbs={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Customers', href: '/customers' },
 *     { labelKey: 'customer.name' }
 *   ]}
 *   actions={[
 *     { id: 'edit', label: 'Edit', type: 'navigate', href: '/customers/{{id}}/edit' }
 *   ]}
 *   data={pageData}
 *   context={context}
 *   onAction={handleAction}
 *   onNavigate={handleNavigate}
 * />
 * ```
 */
export function PageHeader({
    title,
    description,
    icon,
    actions,
    breadcrumbs,
    data,
    context,
    onAction,
    onNavigate,
    className,
}: PageHeaderProps) {
    return (
        <header className={`fusion-page-header ${className || ''}`}>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <Breadcrumbs
                    items={breadcrumbs}
                    data={data}
                    onNavigate={onNavigate}
                />
            )}

            {/* Title Row */}
            <div className="fusion-page-header-main">
                <div className="fusion-page-header-content">
                    {/* Icon and Title */}
                    <div className="fusion-page-header-title-row">
                        {icon && (
                            <span className="fusion-page-header-icon">
                                {renderIcon(icon)}
                            </span>
                        )}
                        <h1 className="fusion-page-header-title">{title}</h1>
                    </div>

                    {/* Description */}
                    {description && (
                        <p className="fusion-page-header-description">{description}</p>
                    )}
                </div>

                {/* Actions */}
                {actions && actions.length > 0 && (
                    <div className="fusion-page-header-actions">
                        {actions.map((action, index) => (
                            <ActionButton
                                key={action.id || `action-${index}`}
                                action={action}
                                data={data}
                                context={context}
                                onClick={onAction}
                            />
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
