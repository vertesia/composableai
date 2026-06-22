import type {
    CreateEventSubscriptionPayload,
    EventCategory,
    EventDeliveryTargetInput,
    EventPriority,
    EventSubscriptionFilter,
    UpdateEventSubscriptionPayload,
} from './platform-event.js';
import { SystemRoles } from './project.js';
import type { AgentRunStatus } from './store/index.js';

/**
 * Statuses an `agent_signal` target may list in `statuses` — the run statuses that can be **directly
 * signalled**. Only a live (`running`, possibly idle) run has an active Temporal workflow that accepts a
 * signal; `created` runs have no workflow bound yet, and terminal runs are handled separately by
 * `on_terminal` (`restart` re-activates the newest terminal run, then signals). Restricting the set keeps
 * config from silently trying to signal a closed workflow.
 */
const SIGNALABLE_AGENT_RUN_STATUS_VALUES: readonly AgentRunStatus[] = ['running'];

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;
export const MAX_WEBHOOK_TIMEOUT_MS = 50_000;

export const EVENT_CATEGORIES: readonly EventCategory[] = [
    'content',
    'workflow',
    'security',
    'billing',
    'system',
    'external',
];
export const EVENT_PRIORITIES: readonly EventPriority[] = ['high', 'normal', 'low'];

/** Default agent-evaluator iteration budget for a semantic condition. */
export const DEFAULT_SEMANTIC_AGENT_MAX_ITERATIONS = 10;
/** Maximum agent-evaluator iteration budget a user may request. */
export const MAX_SEMANTIC_AGENT_MAX_ITERATIONS = 30;
/** Default content-excerpt size (chars) included in the interaction classifier prompt. */
export const DEFAULT_SEMANTIC_MAX_CONTENT_CHARS = 4000;
/** Maximum content-excerpt size (chars) a user may request. */
export const MAX_SEMANTIC_MAX_CONTENT_CHARS = 20_000;
/** Maximum length of a semantic condition instruction. */
export const MAX_SEMANTIC_CONDITION_INSTRUCTION_LENGTH = 2000;

/** Default action stamped on an ingested external event when none is provided/mapped. */
export const DEFAULT_EXTERNAL_EVENT_ACTION = 'received';
/** Default resource_type stamped on an ingested external event when none is provided/mapped. */
export const DEFAULT_EXTERNAL_EVENT_RESOURCE_TYPE = 'external_event';
/** Prefix combined with a channel `source` to form the event `source` (`external:<source>`). */
export const EXTERNAL_EVENT_SOURCE_PREFIX = 'external:';

/** Role an event subscription runs as when none is specified. */
export const DEFAULT_EVENT_SUBSCRIPTION_RUN_AS_ROLE = SystemRoles.automation;

/**
 * Roles a user may select for an event subscription's run_as_role. System subscriptions may use
 * additional roles (e.g. content_processor); this list gates user input in the API, agent tools,
 * and UI — keep all three consuming this constant.
 */
export const EVENT_SUBSCRIPTION_RUN_AS_ROLES: readonly SystemRoles[] = [
    SystemRoles.automation,
    SystemRoles.executor,
    SystemRoles.reader,
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
    if (
        type !== 'workflow' &&
        type !== 'webhook' &&
        type !== 'agent' &&
        type !== 'agent_signal' &&
        type !== 'process'
    ) {
        errors.push('target.type must be one of workflow, webhook, agent, agent_signal, process');
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
        case 'agent_signal': {
            if (typeof t.message_path !== 'string' || t.message_path.length === 0) {
                errors.push('agent_signal target requires a non-empty "message_path"');
            }
            // Only the UserInput signal is implemented (the dispatcher always sends a UserInput-shaped
            // payload), so reject other names rather than silently mis-deliver.
            if (t.signal_name !== undefined && t.signal_name !== 'UserInput') {
                errors.push('agent_signal target.signal_name must be "UserInput"');
            }
            // Optional dot-path / ref fields are read dynamically at runtime — reject non-strings early.
            for (const field of ['interaction_ref', 'client_message_id_path', 'skip_if_path_exists', 'author_path']) {
                const value = (t as unknown as Record<string, unknown>)[field];
                if (value !== undefined && typeof value !== 'string') {
                    errors.push(`agent_signal target.${field} must be a string`);
                }
            }
            if (t.metadata !== undefined && !isRecord(t.metadata)) {
                errors.push('agent_signal target.metadata must be an object');
            }
            if (t.statuses !== undefined) {
                if (!isStringArray(t.statuses)) {
                    errors.push('agent_signal target.statuses must be an array of strings');
                } else {
                    const invalid = t.statuses.filter(
                        (s) => !SIGNALABLE_AGENT_RUN_STATUS_VALUES.includes(s as AgentRunStatus),
                    );
                    if (invalid.length > 0) {
                        errors.push(
                            `agent_signal target.statuses may only contain signalable statuses: ${invalid.join(', ')} ` +
                                `not allowed. Allowed: ${SIGNALABLE_AGENT_RUN_STATUS_VALUES.join(', ')} ` +
                                `(terminal runs are handled by on_terminal).`,
                        );
                    }
                }
            }
            if (t.ignore_author_patterns !== undefined && !isStringArray(t.ignore_author_patterns)) {
                errors.push('agent_signal target.ignore_author_patterns must be an array of strings');
            }
            if (t.require_command_prefixes !== undefined && !isStringArray(t.require_command_prefixes)) {
                errors.push('agent_signal target.require_command_prefixes must be an array of strings');
            }
            if (t.require_mentions !== undefined && !isStringArray(t.require_mentions)) {
                errors.push('agent_signal target.require_mentions must be an array of strings');
            }
            if (t.missing_thread !== undefined && t.missing_thread !== 'retry' && t.missing_thread !== 'skip') {
                errors.push('agent_signal target.missing_thread must be "retry" or "skip"');
            }
            if (t.on_terminal !== undefined && t.on_terminal !== 'skip' && t.on_terminal !== 'restart') {
                errors.push('agent_signal target.on_terminal must be "skip" or "restart"');
            }
            break;
        }
    }
}

function validateCommonFields(payload: Partial<CreateEventSubscriptionPayload>, errors: string[]): void {
    if (payload.description !== undefined && typeof payload.description !== 'string') {
        errors.push('description must be a string');
    }
    if (payload.run_as_role !== undefined && !Object.values(SystemRoles).includes(payload.run_as_role)) {
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
    // run_as_role is required at creation: every subscription must declare an explicit run-as
    // identity so its delivery never falls back to running as the originating (possibly deleted)
    // user. validateCommonFields validates the value when present; this enforces presence.
    if (payload?.run_as_role === undefined) {
        errors.push('run_as_role is required');
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
