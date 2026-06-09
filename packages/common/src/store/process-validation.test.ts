import { describe, expect, it } from 'vitest';
import { PROCESS_DEFINITION_FORMAT_VERSION, type ProcessDefinitionBody } from './process.js';
import {
    getProcessDefinitionValidationResult,
    getProcessInteractionValidationSelectors,
    MAX_PROCESS_GUARD_DEPTH,
    MAX_PROCESS_GUARD_NODES,
    validateProcessDefinitionBody,
} from './process-validation.js';

function validDefinition(): ProcessDefinitionBody {
    return {
        format_version: PROCESS_DEFINITION_FORMAT_VERSION,
        process: 'approval',
        initial: 'review',
        metadata: {
            provenance: {
                bpmn: {
                    process_id: 'ApprovalProcess',
                },
            },
        },
        context: {
            schema: {
                type: 'object',
                properties: {
                    approved: { type: 'boolean' },
                },
                required: ['approved'],
                additionalProperties: false,
            },
            initial: { approved: false },
        },
        nodes: {
            review: {
                type: 'human_task',
                task: {
                    title: 'Review',
                    fields: [{ name: 'approved', type: 'boolean', required: true }],
                },
                transitions: [{ to: 'approved', trigger: 'user', metadata: { edge_kind: 'default' } }],
            },
            approved: {
                type: 'final',
            },
        },
    };
}

describe('process definition validation', () => {
    it('accepts a structurally valid definition', () => {
        expect(() => validateProcessDefinitionBody(validDefinition())).not.toThrow();
    });

    it('rejects missing transition targets', () => {
        const definition = validDefinition();
        definition.nodes.review.transitions = [{ to: 'missing' }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'node "review" has transition to "missing" which does not exist',
        );
    });

    it('rejects missing branch targets', () => {
        const definition = validDefinition();
        definition.nodes.review.type = 'condition';
        definition.nodes.review.task = undefined;
        definition.nodes.review.transitions = undefined;
        definition.nodes.review.branches = [{ to: 'missing', default: true }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'node "review" has branch to "missing" which does not exist',
        );
    });

    it('rejects unsupported foreach child node types', () => {
        const definition = validDefinition();
        definition.initial = 'fanout';
        definition.context.schema = {
            type: 'object',
            properties: {
                items: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: 'foreach',
                foreach: 'items',
                node: {
                    type: 'human_task',
                    task: {
                        title: 'Review',
                        fields: [],
                    },
                },
                transitions: [{ to: 'approved' }],
            },
            approved: {
                type: 'final',
            },
        };

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'foreach node "fanout" has unsupported child node type "human_task"',
        );
    });

    it('accepts process nodes as standalone nodes and foreach children', () => {
        const child = validDefinition();
        child.process = 'child_approval';

        const definition = validDefinition();
        definition.initial = 'fanout';
        definition.context.schema = {
            type: 'object',
            properties: {
                items: { type: 'array', items: { type: 'object' } },
                results: { type: 'array' },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: 'foreach',
                foreach: 'items',
                as: 'item',
                item_id: '{{item.id}}',
                max_concurrency: 10,
                collect: {
                    into: 'results',
                    include: ['status', 'index', 'item_id', 'output', 'child_run_id'],
                },
                node: {
                    type: 'process',
                    process_definition: child,
                    input: { invoice: '{{item}}' },
                    returns: { from: 'context.approved' },
                },
                transitions: [{ to: 'approved' }],
            },
            approved: {
                type: 'final',
            },
        };

        expect(() => validateProcessDefinitionBody(definition)).not.toThrow();
    });

    it('rejects fanout child nodes that define their own transitions', () => {
        const child = validDefinition();
        child.process = 'child_approval';

        const definition = validDefinition();
        definition.initial = 'fanout';
        definition.context.schema = {
            type: 'object',
            properties: {
                items: { type: 'array', items: { type: 'object' } },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: 'foreach',
                foreach: 'items',
                node: {
                    type: 'process',
                    process_definition: child,
                    transitions: [{ to: 'approved' }],
                },
                transitions: [{ to: 'approved' }],
            },
            approved: {
                type: 'final',
            },
        };

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'foreach node "fanout" child node must not define transitions',
        );
    });

    it('rejects process nodes without a referenced or inline process', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'process',
            transitions: [{ to: 'approved' }],
        };

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'process node "review" is missing process or process_definition',
        );
    });

    it('rejects set_context nodes that omit the updates envelope', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'tool',
            tool: 'set_context',
            input: {
                approved: true,
            },
            writes: ['approved'],
            transitions: [{ to: 'approved' }],
        };

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('tool node "review" set_context input has unsupported property "approved"');
        expect(result.errors).toContain('tool node "review" set_context input.updates must be an object');
    });

    it('accepts set_context nodes with the updates envelope', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'tool',
            tool: 'set_context',
            input: {
                updates: {
                    approved: true,
                },
                reason: 'mark approved in validation test',
            },
            writes: ['approved'],
            transitions: [{ to: 'approved' }],
        };

        expect(() => validateProcessDefinitionBody(definition)).not.toThrow();
    });

    it('rejects set_context nodes that write undeclared or internal fields', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'tool',
            tool: 'set_context',
            input: {
                updates: {
                    approved: true,
                    _current_node: 'approved',
                },
            },
            writes: ['decision'],
            transitions: [{ to: 'approved' }],
        };

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'tool node "review" set_context updates "approved" but writes does not allow it',
        );
        expect(result.errors).toContain(
            'tool node "review" set_context cannot write reserved context field "_current_node"',
        );
    });

    it('rejects unknown tools when a runtime tool catalog is provided', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'tool',
            tool: 'missing_tool',
            input: {},
            transitions: [{ to: 'approved' }],
        };

        const result = getProcessDefinitionValidationResult(definition, { knownTools: ['set_context'] });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('tool node "review" references unknown tool "missing_tool"');
    });

    it('rejects unknown interactions when a runtime interaction catalog is provided', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'interaction',
            interaction: 'sys:MissingInteraction',
            writes: ['approved'],
            transitions: [{ to: 'approved' }],
        };

        const result = getProcessDefinitionValidationResult(definition, { knownInteractions: ['sys:GeneralAgent'] });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'interaction node "review" references unknown interaction "sys:MissingInteraction"',
        );
    });

    it('rejects non-object result_schema on agent and interaction nodes', () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: 'agent',
            interaction: 'sys:GeneralAgent',
            writes: ['approved'],
            transitions: [{ to: 'approved' }],
        };
        Object.assign(definition.nodes.review, { result_schema: 'not a schema' });

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('agent node "review" result_schema must be a JSON Schema object');
    });

    it('builds interaction selectors used by process validation', () => {
        const selectors = getProcessInteractionValidationSelectors([
            { type: 'sys', id: 'sys:GeneralAgent', name: 'GeneralAgent', title: 'General agent', tags: [] },
            {
                type: 'stored',
                id: '65f000000000000000000001',
                name: 'contract-risk',
                version: 3,
                title: 'Contract risk',
                tags: [],
            },
            { type: 'app', id: 'claims/score', name: 'score_claim', title: 'Score claim', tags: [] },
        ]);

        expect(selectors).toContain('sys:GeneralAgent');
        expect(selectors).toContain('GeneralAgent');
        expect(selectors).toContain('contract-risk@draft');
        expect(selectors).toContain('65f000000000000000000001@3');
        expect(selectors).toContain('app:claims/score');
    });

    it('rejects string branch conditions so broken definitions do not save', () => {
        const definition = validDefinition();
        const branchWithStringCondition = {
            to: 'approved',
            condition: 'context.approved == true',
        };
        definition.nodes.review.type = 'condition';
        definition.nodes.review.task = undefined;
        definition.nodes.review.transitions = undefined;
        definition.nodes.review.branches = [branchWithStringCondition];

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'node "review" branch at index 0 uses string condition; use JSON Logic in "when" instead',
        );
    });

    it('rejects invalid foreach fanout controls', () => {
        const definition = validDefinition();
        definition.initial = 'fanout';
        definition.context.schema = {
            type: 'object',
            properties: {
                items: { type: 'array' },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: 'foreach',
                foreach: 'items',
                max_concurrency: 0,
                collect: {
                    into: '',
                    include: ['status'],
                },
                node: {
                    type: 'process',
                    process: '64f000000000000000000000',
                },
                transitions: [{ to: 'approved' }],
            },
            approved: {
                type: 'final',
            },
        };
        Object.assign(definition.nodes.fanout.collect ?? {}, { include: ['bogus'] });

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('foreach node "fanout" max_concurrency must be a positive integer');
        expect(result.errors).toContain('foreach node "fanout" collect.into is required');
        expect(result.errors).toContain('foreach node "fanout" collect.include has invalid field "bogus"');
    });

    it('reports all structural errors without importing runtime schema validators', () => {
        const definition = {
            format_version: PROCESS_DEFINITION_FORMAT_VERSION,
            process: '',
            initial: 'missing',
            context: {
                schema: {},
                initial: {},
            },
            nodes: {
                review: {
                    type: 'human_task',
                },
            },
        } satisfies ProcessDefinitionBody;

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('initial node "missing" does not exist');
        expect(result.errors).toContain('human_task node "review" is missing task');
    });

    it('rejects overly deep guard rules', () => {
        const definition = validDefinition();
        let guard: Record<string, unknown> = { var: 'approved' };
        for (let index = 0; index < MAX_PROCESS_GUARD_DEPTH; index += 1) {
            guard = { '!': [guard] };
        }
        definition.nodes.review.transitions = [{ to: 'approved', guard }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow('exceeds maximum depth');
    });

    it('rejects overly large guard rules', () => {
        const definition = validDefinition();
        definition.nodes.review.transitions = [
            { to: 'approved', guard: { and: Array.from({ length: MAX_PROCESS_GUARD_NODES + 1 }, () => true) } },
        ];

        expect(() => validateProcessDefinitionBody(definition)).toThrow('exceeds maximum node count');
    });

    it('rejects a definition with no final node', () => {
        const definition = validDefinition();
        // Turn the only final into a non-final node that loops back to review.
        definition.nodes.approved = {
            type: 'human_task',
            task: { title: 'Re-review', fields: [] },
            transitions: [{ to: 'review', trigger: 'user' }],
        };

        const result = getProcessDefinitionValidationResult(definition);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('process has no final node; it can never complete');
    });

    it('rejects a definition whose only final node is unreachable from initial', () => {
        const definition = validDefinition();
        // review loops to a tool node and back; the final "approved" exists but
        // nothing routes to it.
        definition.nodes.review.transitions = [{ to: 'loop', trigger: 'user' }];
        definition.nodes.loop = {
            type: 'tool',
            tool: 'think',
            transitions: [{ to: 'review' }],
        };

        const result = getProcessDefinitionValidationResult(definition);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('no final node is reachable from initial node "review"');
    });

    it('accepts a definition where a final node is reachable through a cycle', () => {
        const definition = validDefinition();
        // review -> loop -> review (cycle) and review -> approved (final).
        definition.nodes.review.transitions = [
            { to: 'loop', trigger: 'user' },
            { to: 'approved', trigger: 'user' },
        ];
        definition.nodes.loop = {
            type: 'tool',
            tool: 'think',
            transitions: [{ to: 'review' }],
        };

        expect(() => validateProcessDefinitionBody(definition)).not.toThrow();
    });

    it('accepts a positive limits.max_transitions', () => {
        const definition = validDefinition();
        definition.limits = { max_transitions: 250 };

        expect(() => validateProcessDefinitionBody(definition)).not.toThrow();
    });

    it('rejects a non-positive or non-integer limits.max_transitions', () => {
        for (const bad of [0, -5, 2.5]) {
            const definition = validDefinition();
            definition.limits = { max_transitions: bad };
            const result = getProcessDefinitionValidationResult(definition);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('limits.max_transitions must be a positive integer');
        }
    });
});
