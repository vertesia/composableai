import type {
    CreateEventSubscriptionPayload,
    EventCategory,
    EventDeliveryTargetInput,
    EventPriority,
    EventSubscriptionFilter,
    UpdateEventSubscriptionPayload,
} from './platform-event.js';
import { ProjectRoles } from './project.js';

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;
export const MAX_WEBHOOK_TIMEOUT_MS = 50_000;

export const EVENT_CATEGORIES: readonly EventCategory[] = ['content', 'workflow', 'security', 'billing', 'system'];
export const EVENT_PRIORITIES: readonly EventPriority[] = ['high', 'normal', 'low'];

/** Role an event subscription runs as when none is specified. */
export const DEFAULT_EVENT_SUBSCRIPTION_RUN_AS_ROLE = ProjectRoles.automation;

/**
 * Roles a user may select for an event subscription's run_as_role. System subscriptions may use
 * additional roles (e.g. content_processor); this list gates user input in the API, agent tools,
 * and UI — keep all three consuming this constant.
 */
export const EVENT_SUBSCRIPTION_RUN_AS_ROLES: readonly ProjectRoles[] = [
    ProjectRoles.automation,
    ProjectRoles.executor,
    ProjectRoles.reader,
];

/**
 * JSONLogic operators accepted in event subscription filter conditions. The event-bus evaluator
 * rejects any operator not in this list (fail closed); the UI condition editor uses it for
 * completion and validation.
 */
export const EVENT_CONDITION_JSON_LOGIC_OPERATORS: readonly string[] = [
    '!',
    '!!',
    '!=',
    '!==',
    '%',
    '*',
    '+',
    '-',
    '/',
    '<',
    '<=',
    '==',
    '===',
    '>',
    '>=',
    '?:',
    'all',
    'and',
    'cat',
    'filter',
    'if',
    'in',
    'log',
    'map',
    'max',
    'merge',
    'min',
    'missing',
    'missing_some',
    'none',
    'or',
    'reduce',
    'some',
    'substr',
    'var',
];

export interface EventSubscriptionValidationResult {
    valid: boolean;
    errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateFilter(filter: unknown, errors: string[]): void {
    if (!isRecord(filter)) {
        errors.push('filter must be an object');
        return;
    }
    const f = filter as EventSubscriptionFilter;
    if (f.event_category !== undefined) {
        if (!isStringArray(f.event_category)) {
            errors.push('filter.event_category must be an array of strings');
        } else {
            for (const c of f.event_category) {
                if (c !== '*' && !EVENT_CATEGORIES.includes(c as EventCategory)) {
                    errors.push(`filter.event_category contains unsupported value: ${c}`);
                }
            }
        }
    }
    if (f.exclude_event_category !== undefined) {
        if (!isStringArray(f.exclude_event_category)) {
            errors.push('filter.exclude_event_category must be an array of strings');
        } else {
            for (const c of f.exclude_event_category) {
                if (!EVENT_CATEGORIES.includes(c)) {
                    errors.push(`filter.exclude_event_category contains unsupported value: ${c}`);
                }
            }
        }
    }
    if (f.action !== undefined && !isStringArray(f.action)) {
        errors.push('filter.action must be an array of strings');
    }
    if (f.resource_type !== undefined && !isStringArray(f.resource_type)) {
        errors.push('filter.resource_type must be an array of strings');
    }
    if (f.condition !== undefined && !isRecord(f.condition)) {
        errors.push('filter.condition must be a JSON Logic object');
    }
}

function validateTarget(target: unknown, errors: string[]): void {
    if (!isRecord(target)) {
        errors.push('target must be an object');
        return;
    }
    const type = target.type;
    if (type !== 'workflow' && type !== 'webhook' && type !== 'agent' && type !== 'process') {
        errors.push('target.type must be one of workflow, webhook, agent, process');
        return;
    }
    const t = target as EventDeliveryTargetInput;
    switch (t.type) {
        case 'workflow':
            if (typeof t.endpoint !== 'string' || t.endpoint.length === 0) {
                errors.push('workflow target requires a non-empty "endpoint"');
            }
            break;
        case 'webhook': {
            if (typeof t.url !== 'string' || t.url.length === 0) {
                errors.push('webhook target requires a non-empty "url"');
            }
            if (t.timeout_ms !== undefined) {
                if (!Number.isInteger(t.timeout_ms) || t.timeout_ms <= 0 || t.timeout_ms > MAX_WEBHOOK_TIMEOUT_MS) {
                    errors.push(`webhook target.timeout_ms must be an integer between 1 and ${MAX_WEBHOOK_TIMEOUT_MS}`);
                }
            }
            if (t.signing_mode !== undefined && t.signing_mode !== 'signed' && t.signing_mode !== 'legacy_unsigned') {
                errors.push('webhook target.signing_mode must be "signed" or "legacy_unsigned"');
            }
            if (
                t.payload_mode !== undefined &&
                t.payload_mode !== 'event_envelope' &&
                t.payload_mode !== 'legacy_notify_endpoint' &&
                t.payload_mode !== 'workflow_notification'
            ) {
                errors.push(
                    'webhook target.payload_mode must be "event_envelope", "legacy_notify_endpoint" or "workflow_notification"',
                );
            }
            if (t.encrypted_headers === true) {
                errors.push('webhook target.encrypted_headers is not supported');
            }
            if (t.headers !== undefined && !isRecord(t.headers)) {
                errors.push('webhook target.headers must be an object of strings');
            }
            break;
        }
        case 'process':
            if ((typeof t.process_ref !== 'string' || t.process_ref.length === 0) && !isRecord(t.process_definition)) {
                errors.push('process target requires "process_ref" or an inline "process_definition"');
            }
            break;
        case 'agent':
            // interaction_ref is optional (defaults to the general system agent); nothing required.
            break;
    }
}

function validateCommonFields(payload: Partial<CreateEventSubscriptionPayload>, errors: string[]): void {
    if (payload.description !== undefined && typeof payload.description !== 'string') {
        errors.push('description must be a string');
    }
    if (payload.run_as_role !== undefined && !Object.values(ProjectRoles).includes(payload.run_as_role)) {
        errors.push(`run_as_role contains unsupported value: ${payload.run_as_role}`);
    }
    if (payload.enabled !== undefined && typeof payload.enabled !== 'boolean') {
        errors.push('enabled must be a boolean');
    }
    if (payload.priority !== undefined && !EVENT_PRIORITIES.includes(payload.priority)) {
        errors.push(`priority must be one of ${EVENT_PRIORITIES.join(', ')}`);
    }
}

export function getCreateEventSubscriptionValidationResult(
    payload: CreateEventSubscriptionPayload,
): EventSubscriptionValidationResult {
    const errors: string[] = [];
    if (typeof payload?.name !== 'string' || payload.name.trim().length === 0) {
        errors.push('name is required');
    }
    if (payload?.scope !== undefined && payload.scope !== 'account' && payload.scope !== 'project') {
        errors.push('scope must be "account" or "project"');
    }
    if (payload?.filter === undefined) {
        errors.push('filter is required');
    } else {
        validateFilter(payload.filter, errors);
    }
    if (payload?.target === undefined) {
        errors.push('target is required');
    } else {
        validateTarget(payload.target, errors);
    }
    validateCommonFields(payload ?? {}, errors);
    return { valid: errors.length === 0, errors };
}

export function getUpdateEventSubscriptionValidationResult(
    payload: UpdateEventSubscriptionPayload,
): EventSubscriptionValidationResult {
    const errors: string[] = [];
    if (!isRecord(payload)) {
        return { valid: false, errors: ['update payload must be an object'] };
    }
    if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.trim().length === 0)) {
        errors.push('name must be a non-empty string');
    }
    if (payload.filter !== undefined) {
        validateFilter(payload.filter, errors);
    }
    if (payload.target !== undefined) {
        validateTarget(payload.target, errors);
    }
    validateCommonFields(payload, errors);
    return { valid: errors.length === 0, errors };
}

export function validateCreateEventSubscriptionInput(payload: CreateEventSubscriptionPayload): void {
    const result = getCreateEventSubscriptionValidationResult(payload);
    if (!result.valid) {
        throw new Error(result.errors.join('; '));
    }
}

export function validateUpdateEventSubscriptionInput(payload: UpdateEventSubscriptionPayload): void {
    const result = getUpdateEventSubscriptionValidationResult(payload);
    if (!result.valid) {
        throw new Error(result.errors.join('; '));
    }
}
