/**
 * Action Button
 *
 * Renders an action button that triggers various action types.
 */

import React from 'react';
import type { ActionSpec, ConditionalSpec, IconSpec } from '@vertesia/common';
import type { ActionButtonProps } from './types.js';

/**
 * Evaluate a conditional spec against data.
 */
function evaluateCondition(
    condition: ConditionalSpec | undefined,
    data: Record<string, unknown>
): boolean {
    if (!condition) return true;

    const { type, field, value } = condition;

    // If no field, can't evaluate (except for custom expressions)
    if (!field && type !== 'custom') {
        return true;
    }

    // Get field value if field is specified
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
            return fieldValue === undefined || fieldValue === null || fieldValue === '' ||
                (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'isNotEmpty':
            return fieldValue !== undefined && fieldValue !== null && fieldValue !== '' &&
                !(Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'greaterThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
        case 'lessThan':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
        case 'hasPermission':
            // Permission checking should be handled by the application
            return true;
        case 'custom':
            // Custom expressions should be handled by the application
            return true;
        default:
            return true;
    }
}

/**
 * Render an icon based on its type.
 */
function renderIcon(icon: IconSpec): React.ReactNode {
    switch (icon.type) {
        case 'emoji':
            return <span className="fusion-icon fusion-icon-emoji">{icon.value}</span>;
        case 'lucide':
            return <span className="fusion-icon fusion-icon-lucide" data-icon={icon.value} />;
        case 'url':
            return <img className="fusion-icon fusion-icon-image" src={icon.value} alt="" />;
        default:
            return null;
    }
}

/**
 * Interpolate a string with data values.
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
 * Action button component.
 *
 * @example
 * ```tsx
 * <ActionButton
 *   action={{
 *     id: 'edit',
 *     type: 'navigate',
 *     label: 'Edit',
 *     href: '/customers/{{id}}/edit',
 *     variant: 'primary'
 *   }}
 *   data={{ id: '123' }}
 *   context={context}
 *   onClick={(action, data) => handleAction(action, data)}
 * />
 * ```
 */
export function ActionButton({
    action,
    data = {},
    context: _context,
    loading,
    className,
    onClick,
}: ActionButtonProps) {
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [isExecuting, setIsExecuting] = React.useState(false);

    // Check visibility condition
    if (!evaluateCondition(action.showIf, data)) {
        return null;
    }

    const isDisabled = action.disabled || loading || isExecuting;

    // Build class names
    const classNames = [
        'fusion-action-button',
        `fusion-action-${action.variant || 'default'}`,
        `fusion-action-size-${action.size || 'md'}`,
        isDisabled ? 'fusion-action-disabled' : '',
        isExecuting ? 'fusion-action-loading' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    const handleClick = async () => {
        // Show confirmation dialog if needed
        if (action.confirm && !showConfirm) {
            setShowConfirm(true);
            return;
        }

        setShowConfirm(false);
        setIsExecuting(true);

        try {
            if (onClick) {
                await onClick(action, data);
            }
        } finally {
            setIsExecuting(false);
        }
    };

    const handleCancel = () => {
        setShowConfirm(false);
    };

    // Confirmation dialog
    if (showConfirm && action.confirm) {
        return (
            <div className="fusion-action-confirm-overlay">
                <div className="fusion-action-confirm-dialog">
                    <h4 className="fusion-action-confirm-title">
                        {interpolateString(action.confirm.title, data)}
                    </h4>
                    <p className="fusion-action-confirm-message">
                        {interpolateString(action.confirm.message, data)}
                    </p>
                    <div className="fusion-action-confirm-buttons">
                        <button
                            className="fusion-action-confirm-cancel"
                            onClick={handleCancel}
                        >
                            {action.confirm.cancelLabel || 'Cancel'}
                        </button>
                        <button
                            className="fusion-action-confirm-proceed"
                            onClick={handleClick}
                        >
                            {action.confirm.confirmLabel || 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <button
            className={classNames}
            disabled={isDisabled}
            onClick={handleClick}
            aria-busy={isExecuting}
        >
            {action.icon && renderIcon(action.icon)}
            <span className="fusion-action-label">{action.label}</span>
            {isExecuting && <span className="fusion-action-spinner" />}
        </button>
    );
}

/**
 * Action handler that processes different action types.
 * Applications should implement their own handlers for specific needs.
 */
export async function executeAction(
    action: ActionSpec,
    data: Record<string, unknown>,
    handlers: {
        onNavigate?: (href: string, newTab?: boolean) => void;
        onApi?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
        onModal?: (content: unknown) => void;
        onAgent?: (message: string, interactionId?: string) => void;
        onDownload?: (url: string, filename?: string) => void;
        onCustom?: (handler: string, params?: Record<string, unknown>) => Promise<unknown>;
    }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
        switch (action.type) {
            case 'navigate': {
                const href = interpolateString(action.href, data);
                handlers.onNavigate?.(href, action.newTab);
                return { success: true };
            }

            case 'api': {
                const endpoint = interpolateString(action.endpoint, data);
                const body = action.body
                    ? interpolateObject(action.body, data)
                    : undefined;

                if (handlers.onApi) {
                    const result = await handlers.onApi(endpoint, action.method, body);
                    return { success: true, result };
                }
                return { success: false, error: 'No API handler configured' };
            }

            case 'modal': {
                handlers.onModal?.(action.modalContent);
                return { success: true };
            }

            case 'agent': {
                const message = interpolateString(action.message, data);
                handlers.onAgent?.(message, action.interactionId);
                return { success: true };
            }

            case 'download': {
                const url = interpolateString(action.url, data);
                const filename = action.filename
                    ? interpolateString(action.filename, data)
                    : undefined;
                handlers.onDownload?.(url, filename);
                return { success: true };
            }

            case 'custom': {
                if (handlers.onCustom) {
                    const params = action.params
                        ? interpolateObject(action.params, data)
                        : undefined;
                    const result = await handlers.onCustom(action.handler, params);
                    return { success: true, result };
                }
                return { success: false, error: 'No custom handler configured' };
            }

            default:
                return { success: false, error: `Unknown action type: ${(action as ActionSpec).type}` };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Interpolate an object with data values.
 */
function interpolateObject<T>(obj: T, data: Record<string, unknown>): T {
    if (typeof obj === 'string') {
        return interpolateString(obj, data) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => interpolateObject(item, data)) as T;
    }

    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = interpolateObject(value, data);
        }
        return result as T;
    }

    return obj;
}
