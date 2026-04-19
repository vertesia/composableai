import { describe, expect, it } from "vitest";
import type { ProcessDefinitionBody } from "./process.js";
import {
    MAX_PROCESS_GUARD_DEPTH,
    MAX_PROCESS_GUARD_NODES,
    getProcessDefinitionValidationResult,
    validateProcessDefinitionBody,
} from "./process-validation.js";

function validDefinition(): ProcessDefinitionBody {
    return {
        process: "approval",
        initial: "review",
        context: {
            schema: {
                type: "object",
                properties: {
                    approved: { type: "boolean" },
                },
                required: ["approved"],
                additionalProperties: false,
            },
            initial: { approved: false },
        },
        nodes: {
            review: {
                type: "human_task",
                task: {
                    title: "Review",
                    fields: [{ name: "approved", type: "boolean", required: true }],
                },
                transitions: [{ to: "approved", trigger: "user" }],
            },
            approved: {
                type: "final",
            },
        },
    };
}

describe("process definition validation", () => {
    it("accepts a structurally valid definition", () => {
        expect(() => validateProcessDefinitionBody(validDefinition())).not.toThrow();
    });

    it("rejects missing transition targets", () => {
        const definition = validDefinition();
        definition.nodes.review.transitions = [{ to: "missing" }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'node "review" has transition to "missing" which does not exist',
        );
    });

    it("rejects missing branch targets", () => {
        const definition = validDefinition();
        definition.nodes.review.type = "condition";
        definition.nodes.review.task = undefined;
        definition.nodes.review.transitions = undefined;
        definition.nodes.review.branches = [{ to: "missing", default: true }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'node "review" has branch to "missing" which does not exist',
        );
    });

    it("rejects unsupported parallel child node types", () => {
        const definition = validDefinition();
        definition.initial = "fanout";
        definition.context.schema = {
            type: "object",
            properties: {
                items: { type: "array", items: { type: "string" } },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: "parallel",
                foreach: "items",
                node: {
                    type: "human_task",
                    task: {
                        title: "Review",
                        fields: [],
                    },
                },
                transitions: [{ to: "approved" }],
            },
            approved: {
                type: "final",
            },
        };

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'parallel node "fanout" has unsupported child node type "human_task"',
        );
    });

    it("accepts process nodes as standalone nodes and parallel children", () => {
        const child = validDefinition();
        child.process = "child_approval";

        const definition = validDefinition();
        definition.initial = "fanout";
        definition.context.schema = {
            type: "object",
            properties: {
                items: { type: "array", items: { type: "object" } },
                results: { type: "array" },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: "parallel",
                foreach: "items",
                as: "item",
                item_id: "{{item.id}}",
                max_concurrency: 10,
                collect: {
                    into: "results",
                    include: ["status", "index", "item_id", "output", "child_run_id"],
                },
                node: {
                    type: "process",
                    process_definition: child,
                    input: { invoice: "{{item}}" },
                    returns: { from: "context.approved" },
                },
                transitions: [{ to: "approved" }],
            },
            approved: {
                type: "final",
            },
        };

        expect(() => validateProcessDefinitionBody(definition)).not.toThrow();
    });

    it("rejects process nodes without a referenced or inline process", () => {
        const definition = validDefinition();
        definition.nodes.review = {
            type: "process",
            transitions: [{ to: "approved" }],
        };

        expect(() => validateProcessDefinitionBody(definition)).toThrow(
            'process node "review" is missing process or process_definition',
        );
    });

    it("rejects invalid parallel fanout controls", () => {
        const definition = validDefinition();
        definition.initial = "fanout";
        definition.context.schema = {
            type: "object",
            properties: {
                items: { type: "array" },
            },
            additionalProperties: true,
        };
        definition.context.initial = { items: [] };
        definition.nodes = {
            fanout: {
                type: "parallel",
                foreach: "items",
                max_concurrency: 0,
                collect: {
                    into: "",
                    include: ["bogus" as "status"],
                },
                node: {
                    type: "process",
                    process: "64f000000000000000000000",
                },
                transitions: [{ to: "approved" }],
            },
            approved: {
                type: "final",
            },
        };

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('parallel node "fanout" max_concurrency must be a positive integer');
        expect(result.errors).toContain('parallel node "fanout" collect.into is required');
        expect(result.errors).toContain('parallel node "fanout" collect.include has invalid field "bogus"');
    });

    it("reports all structural errors without importing runtime schema validators", () => {
        const definition = {
            process: "",
            initial: "missing",
            context: {
                schema: {},
                initial: {},
            },
            nodes: {
                review: {
                    type: "human_task",
                },
            },
        } satisfies ProcessDefinitionBody;

        const result = getProcessDefinitionValidationResult(definition);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('initial node "missing" does not exist');
        expect(result.errors).toContain('human_task node "review" is missing task');
    });

    it("rejects overly deep guard rules", () => {
        const definition = validDefinition();
        let guard: Record<string, unknown> = { var: "approved" };
        for (let index = 0; index < MAX_PROCESS_GUARD_DEPTH; index += 1) {
            guard = { "!": [guard] };
        }
        definition.nodes.review.transitions = [{ to: "approved", guard }];

        expect(() => validateProcessDefinitionBody(definition)).toThrow("exceeds maximum depth");
    });

    it("rejects overly large guard rules", () => {
        const definition = validDefinition();
        definition.nodes.review.transitions = [
            { to: "approved", guard: { and: Array.from({ length: MAX_PROCESS_GUARD_NODES + 1 }, () => true) } },
        ];

        expect(() => validateProcessDefinitionBody(definition)).toThrow("exceeds maximum node count");
    });
});
