import type { JSONSchemaType } from "../json-schema.js";

export const PROCESS_DEFINITION_JSON_SCHEMA_ID = "https://schemas.vertesia.com/process-definition.v1.schema.json";

export const ProcessDefinitionBodyJsonSchema = {
    $id: PROCESS_DEFINITION_JSON_SCHEMA_ID,
    type: "object",
    description: "A process definition describes a state-machine workflow executed by the Process Engine.",
    properties: {
        format_version: {
            type: "integer",
            const: 1,
            description: "Native process definition format version.",
        },
        process: {
            type: "string",
            minLength: 1,
            description: "Stable process code, for example invoice_approval.",
        },
        description: {
            type: "string",
            nullable: true,
            description: "Optional human-readable process description.",
        },
        initial: {
            type: "string",
            minLength: 1,
            description: "Initial node id. Semantic validation verifies this exists in nodes.",
        },
        model: {
            type: "string",
            nullable: true,
            description: "Optional default model for agent and interaction nodes.",
        },
        context: {
            $ref: "#/$defs/processContextDefinition",
        },
        nodes: {
            type: "object",
            description: "Map of node id to node definition.",
            minProperties: 1,
            required: [],
            additionalProperties: {
                $ref: "#/$defs/nodeDefinition",
            },
        },
        metadata: {
            $ref: "#/$defs/metadataDefinition",
        },
    },
    required: ["format_version", "process", "initial", "context", "nodes"],
    additionalProperties: false,
    $defs: {
        metadataDefinition: {
            type: "object",
            nullable: true,
            description: "Execution-irrelevant metadata such as editor layout, provenance, and audit hints.",
            required: [],
            additionalProperties: true,
        },
        processContextDefinition: {
            type: "object",
            properties: {
                schema: {
                    description: "JSON Schema for the process context.",
                    anyOf: [
                        { type: "boolean" },
                        {
                            type: "object",
                            additionalProperties: true,
                        },
                    ],
                },
                initial: {
                    type: "object",
                    description: "Initial context values.",
                    required: [],
                    additionalProperties: true,
                },
            },
            required: ["schema", "initial"],
            additionalProperties: false,
        },
        nodeDefinition: {
            type: "object",
            description: "A state-machine node executed by the Process Engine.",
            properties: {
                type: {
                    type: "string",
                    enum: ["tool", "interaction", "agent", "process", "human_task", "foreach", "branch", "condition", "final"],
                    description: "Node executor type.",
                },
                tool: {
                    type: "string",
                    nullable: true,
                    description: "Builtin or remote tool name for tool nodes.",
                },
                interaction: {
                    type: "string",
                    nullable: true,
                    description: "Interaction id or sys: interaction for interaction and agent nodes.",
                },
                process: {
                    type: "string",
                    nullable: true,
                    description: "Stored child process id or process code for process nodes.",
                },
                process_definition: {
                    $ref: "#",
                    description: "Inline child process definition for process nodes.",
                },
                process_version: {
                    type: "number",
                    nullable: true,
                    description: "Stored child process version.",
                },
                run_type: {
                    type: "string",
                    enum: ["supervised", "programmatic"],
                    nullable: true,
                    description: "Run type for child process nodes.",
                },
                returns: {
                    $ref: "#/$defs/processNodeReturnsDefinition",
                },
                prompt: {
                    type: "string",
                    nullable: true,
                    description: "Prompt or instructions for agent and interaction nodes.",
                },
                input: {
                    type: "object",
                    nullable: true,
                    description: "Node input template. Values may contain {{context_path}} placeholders.",
                    required: [],
                    additionalProperties: true,
                },
                config: {
                    type: "object",
                    nullable: true,
                    description: "Executor-specific configuration.",
                    required: [],
                    additionalProperties: true,
                },
                title: {
                    type: "string",
                    nullable: true,
                    description: "Short display title.",
                },
                description: {
                    type: "string",
                    nullable: true,
                    description: "Developer-facing node description.",
                },
                human_description: {
                    type: "string",
                    nullable: true,
                    description: "End-user-facing explanation of what this node does.",
                },
                writes: {
                    type: "array",
                    nullable: true,
                    description: "Context paths this node may write.",
                    items: { type: "string" },
                },
                skippable: {
                    type: "boolean",
                    nullable: true,
                    description: "Whether a supervisor may skip this node.",
                },
                max_retries: {
                    type: "number",
                    nullable: true,
                    description: "Maximum node retry attempts.",
                },
                transitions: {
                    type: "array",
                    nullable: true,
                    description: "Outgoing transitions. Semantic validation verifies targets exist.",
                    items: { $ref: "#/$defs/transitionDefinition" },
                },
                tools: {
                    type: "array",
                    nullable: true,
                    description: "Additional tool names available to an agent node.",
                    items: { type: "string" },
                },
                model: {
                    type: "string",
                    nullable: true,
                    description: "Model override for this node.",
                },
                task: {
                    $ref: "#/$defs/humanTaskDefinition",
                },
                foreach: {
                    type: "string",
                    nullable: true,
                    description: "Context path to an array for foreach nodes.",
                },
                as: {
                    type: "string",
                    nullable: true,
                    description: "Variable name for the current foreach item. Defaults to item.",
                },
                item_id: {
                    type: "string",
                    nullable: true,
                    description: "Template for a stable item id in foreach collection output.",
                },
                node: {
                    $ref: "#/$defs/nodeDefinition",
                    description: "Child node executed for each foreach item or branch child definition.",
                },
                max_concurrency: {
                    type: "integer",
                    minimum: 1,
                    nullable: true,
                    description: "Maximum concurrent child executions for foreach nodes.",
                },
                collect: {
                    description: "Where and how to collect foreach or branch results.",
                    oneOf: [
                        { type: "string", minLength: 1 },
                        { $ref: "#/$defs/parallelCollectDefinition" },
                    ],
                },
                failure_policy: {
                    type: "string",
                    enum: ["fail_fast", "collect_errors"],
                    nullable: true,
                    description: "Foreach or branch failure policy.",
                },
                join: {
                    type: "string",
                    enum: ["all"],
                    nullable: true,
                    description: "Branch join policy.",
                },
                branches: {
                    type: "array",
                    nullable: true,
                    description: "Condition or branch-node branches. Semantic validation verifies the type-specific shape.",
                    items: {
                        oneOf: [
                            { $ref: "#/$defs/branchDefinition" },
                            { $ref: "#/$defs/branchNodeBranchDefinition" },
                        ],
                    },
                },
                metadata: {
                    $ref: "#/$defs/metadataDefinition",
                },
            },
            required: ["type"],
            additionalProperties: false,
        },
        transitionDefinition: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    minLength: 1,
                    description: "Target node id.",
                },
                guard: {
                    $ref: "#/$defs/jsonLogicRule",
                    description: "JSON Logic guard evaluated before transition.",
                },
                trigger: {
                    type: "string",
                    enum: ["auto", "agent", "user"],
                    nullable: true,
                    description: "Transition trigger. Omitted means auto.",
                },
                label: {
                    type: "string",
                    nullable: true,
                    description: "Display label.",
                },
                metadata: {
                    $ref: "#/$defs/metadataDefinition",
                },
            },
            required: ["to"],
            additionalProperties: false,
        },
        branchDefinition: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    minLength: 1,
                    description: "Target node id.",
                },
                when: {
                    $ref: "#/$defs/jsonLogicRule",
                    description: "JSON Logic condition for this branch.",
                },
                default: {
                    type: "boolean",
                    nullable: true,
                    description: "Fallback branch used when no condition matches.",
                },
                metadata: {
                    $ref: "#/$defs/metadataDefinition",
                },
            },
            required: ["to"],
            additionalProperties: false,
        },
        branchNodeBranchDefinition: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    minLength: 1,
                    description: "Stable branch id.",
                },
                title: {
                    type: "string",
                    nullable: true,
                    description: "Optional branch title.",
                },
                description: {
                    type: "string",
                    nullable: true,
                    description: "Optional branch description.",
                },
                node: {
                    $ref: "#/$defs/nodeDefinition",
                    description: "Child node executed for this branch.",
                },
                metadata: {
                    $ref: "#/$defs/metadataDefinition",
                },
            },
            required: ["id", "node"],
            additionalProperties: false,
        },
        humanTaskDefinition: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    minLength: 1,
                    description: "Task title shown in the inbox.",
                },
                description: {
                    type: "string",
                    nullable: true,
                    description: "Task instructions shown to the assignee.",
                },
                assignee: {
                    type: "string",
                    nullable: true,
                    description: "User id or group:<name> assignee reference.",
                },
                fields: {
                    type: "array",
                    description: "Fields required to complete the task.",
                    items: { $ref: "#/$defs/taskField" },
                },
            },
            required: ["title", "fields"],
            additionalProperties: false,
        },
        taskField: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                    description: "Context/result field name.",
                },
                type: {
                    type: "string",
                    enum: ["string", "number", "boolean", "select", "text"],
                    description: "Input field type.",
                },
                required: {
                    type: "boolean",
                    nullable: true,
                    description: "Whether the field must be answered.",
                },
                label: {
                    type: "string",
                    nullable: true,
                    description: "Display label.",
                },
                options: {
                    type: "array",
                    nullable: true,
                    description: "Allowed options for select fields.",
                    items: { type: "string" },
                },
                default: {
                    description: "Default field value.",
                },
            },
            required: ["name", "type"],
            additionalProperties: false,
        },
        processNodeReturnsDefinition: {
            type: "object",
            properties: {
                from: {
                    type: "string",
                    nullable: true,
                    description: "Path to read from child state or context.",
                },
                context: {
                    type: "array",
                    nullable: true,
                    description: "Child context paths to return.",
                    items: { type: "string" },
                },
            },
            required: [],
            additionalProperties: false,
        },
        parallelCollectDefinition: {
            type: "object",
            properties: {
                into: {
                    type: "string",
                    minLength: 1,
                    description: "Context key receiving collected results.",
                },
                mode: {
                    type: "string",
                    enum: ["array"],
                    nullable: true,
                    description: "Collection mode.",
                },
                include: {
                    type: "array",
                    nullable: true,
                    description: "Fields included in each collected item.",
                    items: {
                        type: "string",
                        enum: [
                            "status",
                            "index",
                            "item",
                            "item_id",
                            "branch_id",
                            "branch_title",
                            "output",
                            "context_update",
                            "error",
                            "child_run_id",
                            "child_workflow_id",
                            "child_workflow_run_id",
                        ],
                    },
                },
            },
            required: ["into"],
            additionalProperties: false,
        },
        jsonLogicRule: {
            type: "object",
            description: "JSON Logic expression.",
            required: [],
            additionalProperties: true,
        },
    },
} satisfies JSONSchemaType;
