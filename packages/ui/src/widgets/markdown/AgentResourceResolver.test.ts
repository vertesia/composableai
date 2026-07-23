import { describe, expect, it } from 'vitest';
import { parseAgentResourceHref } from './AgentResourceResolver';

describe('parseAgentResourceHref', () => {
    it.each([
        ['store:doc-1', 'document', 'doc-1'],
        ['document://doc-1', 'document', 'doc-1'],
        ['collection:col-1', 'collection', 'col-1'],
        ['interaction:int-1', 'interaction', 'int-1'],
        ['prompt:prompt-1', 'prompt', 'prompt-1'],
        ['agent:agent-1', 'agent', 'agent-1'],
        ['workflow:workflow-1', 'workflow', 'workflow-1'],
        ['process:process-1', 'process', 'process-1'],
        ['run:run-1', 'interaction_run', 'run-1'],
    ] as const)('maps %s to a resource reference', (rawHref, type, id) => {
        expect(parseAgentResourceHref(rawHref)).toEqual({ type, id });
    });

    it('returns undefined for standard, file, and empty resource URLs', () => {
        expect(parseAgentResourceHref('https://example.com')).toBeUndefined();
        expect(parseAgentResourceHref('artifact:report.pdf')).toBeUndefined();
        expect(parseAgentResourceHref('store:')).toBeUndefined();
    });
});
