import { describe, expect, it } from 'vitest';
import type { CreateEventSubscriptionPayload } from './platform-event.js';
import {
    EVENT_CONDITION_JSON_LOGIC_OPERATORS,
    getCreateEventSubscriptionValidationResult,
    getUpdateEventSubscriptionValidationResult,
} from './platform-event-validation.js';
import { SystemRoles } from './project.js';

function validCreate(overrides: Partial<CreateEventSubscriptionPayload> = {}): CreateEventSubscriptionPayload {
    return {
        name: 'My automation',
        filter: { event_category: ['content'], action: ['create'] },
        target: { type: 'agent', interaction_ref: 'sys:GeneralAgent' },
        run_as_role: SystemRoles.automation,
        ...overrides,
    };
}

describe('event subscription input validation', () => {
    it('accepts a valid create payload', () => {
        expect(getCreateEventSubscriptionValidationResult(validCreate()).valid).toBe(true);
    });

    it('requires a name', () => {
        const result = getCreateEventSubscriptionValidationResult(validCreate({ name: '  ' }));
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('name is required');
    });

    it('requires a run_as_role on create', () => {
        const { run_as_role: _omitted, ...withoutRunAsRole } = validCreate();
        const result = getCreateEventSubscriptionValidationResult(withoutRunAsRole as CreateEventSubscriptionPayload);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('run_as_role is required');
    });

    it('does not require run_as_role on update', () => {
        expect(getUpdateEventSubscriptionValidationResult({ enabled: true }).valid).toBe(true);
    });

    it('rejects an unknown target type', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'unsupported-target' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('target.type');
    });

    it('requires a url for webhook targets', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'webhook' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('url');
    });

    it('bounds the webhook timeout', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'webhook', url: 'https://example.com/hook', timeout_ms: 999_999 } }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('timeout_ms');
    });

    it('requires endpoint for workflow targets', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'workflow' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('endpoint');
    });

    it('requires process_ref or process_definition for process targets', () => {
        const result = getCreateEventSubscriptionValidationResult(validCreate({ target: { type: 'process' } }));
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('process_ref');
    });

    it('accepts a valid agent_signal target', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({
                target: {
                    type: 'agent_signal',
                    message_path: 'details.payload.comment.body',
                    client_message_id_path: 'details.payload.comment.node_id',
                    require_command_prefixes: ['/vertesia'],
                    on_terminal: 'skip',
                    missing_thread: 'retry',
                },
            }),
        );
        expect(result.valid).toBe(true);
    });

    it('requires message_path for agent_signal targets', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('message_path');
    });

    it('rejects a non-string agent_signal message_path', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 123 } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('message_path');
    });

    it('rejects an invalid agent_signal missing_thread', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({
                target: { type: 'agent_signal', message_path: 'm', missing_thread: 'nope' } as never,
            }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('missing_thread');
    });

    it('accepts agent_signal on_terminal:restart', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 'm', on_terminal: 'restart' } }),
        );
        expect(result.valid).toBe(true);
    });

    it('rejects an invalid agent_signal on_terminal value', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 'm', on_terminal: 'nope' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('on_terminal');
    });

    it('rejects an agent_signal signal_name other than UserInput', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 'm', signal_name: 'Stop' } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('signal_name');
    });

    it('rejects agent_signal statuses that are not valid run statuses', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({
                target: { type: 'agent_signal', message_path: 'm', statuses: ['running', 'bogus'] } as never,
            }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('statuses');
        expect(result.errors.join(' ')).toContain('bogus');
    });

    it('rejects agent_signal statuses that are terminal (not signalable)', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 'm', statuses: ['completed'] } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('statuses');
        expect(result.errors.join(' ')).toContain('on_terminal');
    });

    it('rejects non-string agent_signal optional path fields', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ target: { type: 'agent_signal', message_path: 'm', author_path: 123 } as never }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('author_path');
    });

    it('accepts agent_signal with interaction_ref and valid statuses', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({
                target: {
                    type: 'agent_signal',
                    message_path: 'details.payload.comment.body',
                    interaction_ref: 'sys:SoftwareEngineeringAgent',
                    statuses: ['running'],
                    signal_name: 'UserInput',
                    on_terminal: 'skip',
                },
            }),
        );
        expect(result.valid).toBe(true);
    });

    it('rejects unsupported event categories', () => {
        const result = getCreateEventSubscriptionValidationResult(
            validCreate({ filter: { event_category: ['nope'] as never } }),
        );
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('event_category');
    });

    it('accepts a partial update', () => {
        expect(getUpdateEventSubscriptionValidationResult({ enabled: false }).valid).toBe(true);
    });

    it('validates a target supplied in an update', () => {
        const result = getUpdateEventSubscriptionValidationResult({ target: { type: 'webhook' } as never });
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain('url');
    });

    it('does not expose side-effect JSONLogic operators for event conditions', () => {
        expect(EVENT_CONDITION_JSON_LOGIC_OPERATORS).not.toContain('log');
    });
});
