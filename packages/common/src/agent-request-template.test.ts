import { describe, expect, test } from 'vitest';
import {
    renderAgentRequestFallback,
    renderAgentRequestMessage,
    renderAgentRequestTemplate,
} from './agent-request-template.js';

describe('agent request template rendering', () => {
    test('renders top-level, nested, and array placeholders', () => {
        const result = renderAgentRequestTemplate(
            'Research {{topic}} for {{customer.name}} using {{sources.0.name}}.',
            {
                topic: 'Japan news',
                customer: { name: 'Acme' },
                sources: [{ name: 'Reuters' }],
            },
        );

        expect(result).toBe('Research Japan news for Acme using Reuters.');
    });

    test('renders the full JSON payload with json or dot placeholders', () => {
        const data = { task: 'Summarize earnings', depth: 2 };

        expect(renderAgentRequestTemplate('{{json}}', data)).toBe(JSON.stringify(data, null, 2));
        expect(renderAgentRequestTemplate('{{.}}', data)).toBe(JSON.stringify(data, null, 2));
    });

    test('uses stable structured fallback without a template', () => {
        expect(renderAgentRequestFallback({ task: 'Summarize earnings' })).toBe('{\n  "task": "Summarize earnings"\n}');
        expect(renderAgentRequestMessage(undefined, 'plain request')).toBe('plain request');
    });

    test('suppresses configured templates that render empty', () => {
        const data = { missing: null };

        expect(renderAgentRequestMessage('{{missing}}', data)).toBe('');
        expect(renderAgentRequestMessage('{{unknown}}', { task: 'hidden' })).toBe('');
    });
});
