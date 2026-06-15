import { describe, expect, it } from 'vitest';
import type { CreateEventSubscriptionPayload } from './platform-event.js';
import {
    EVENT_CONDITION_JSON_LOGIC_OPERATORS,
    getCreateEventSubscriptionValidationResult,
    getUpdateEventSubscriptionValidationResult,
} from './platform-event-validation.js';

function validCreate(overrides: Partial<CreateEventSubscriptionPayload> = {}): CreateEventSubscriptionPayload {
    return {
        name: 'My automation',
        filter: { event_category: ['content'], action: ['create'] },
        target: { type: 'agent', interaction_ref: 'sys:GeneralAgent' },
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
