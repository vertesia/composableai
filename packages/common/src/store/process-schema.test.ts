import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { PROCESS_DEFINITION_FORMAT_VERSION, type ProcessDefinitionBody } from "./process.js";
import { ProcessDefinitionBodyJsonSchema } from "./process-schema.js";

function validDefinition(): ProcessDefinitionBody {
    return {
        format_version: PROCESS_DEFINITION_FORMAT_VERSION,
        process: "invoice_review",
        initial: "fanout",
        metadata: {
            provenance: {
                bpmn: {
                    process_id: "InvoiceReview",
                },
            },
        },
        context: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    invoices: { type: "array" },
                    results: { type: "array" },
                },
            },
            initial: {
                invoices: [],
            },
        },
        nodes: {
            fanout: {
                type: "foreach",
                foreach: "invoices",
                as: "invoice",
                item_id: "{{invoice.id}}",
                max_concurrency: 10,
                failure_policy: "collect_errors",
                collect: {
                    into: "results",
                    include: ["status", "index", "item_id", "output", "child_run_id"],
                },
                metadata: {
                    editor: {
                        render: "foreach",
                    },
                },
                node: {
                    type: "process",
                    process: "invoice_child_review",
                    run_type: "programmatic",
                    returns: {
                        from: "context.review",
                    },
                },
                transitions: [{ to: "done", metadata: { edge_kind: "default" } }],
            },
            done: {
                type: "final",
            },
        },
    };
}

describe("process definition JSON schema", () => {
    it("accepts current process engine definition features", () => {
        const validate = new Ajv({ allErrors: true, strict: false }).compile(ProcessDefinitionBodyJsonSchema);

        expect(validate(validDefinition())).toBe(true);
    });

    it("rejects malformed process definition shape for editor diagnostics", () => {
        const validate = new Ajv({ allErrors: true, strict: false }).compile(ProcessDefinitionBodyJsonSchema);
        const invalidDefinition = {
            format_version: PROCESS_DEFINITION_FORMAT_VERSION,
            process: "invoice_review",
            initial: "fanout",
            context: {
                schema: {
                    type: "object",
                },
                initial: {},
            },
            nodes: {
                fanout: {
                    type: "foreach",
                    collect: {
                        into: "results",
                        include: ["bogus"],
                    },
                    node: {
                        type: "human_task",
                    },
                    transitions: [{ to: "done", trigger: "manual" }],
                },
                done: {
                    type: "final",
                },
            },
        };

        expect(validate(invalidDefinition)).toBe(false);
        const messages = validate.errors?.map(error => error.message ?? "") ?? [];
        expect(messages).toContain("must be equal to one of the allowed values");
    });
});
