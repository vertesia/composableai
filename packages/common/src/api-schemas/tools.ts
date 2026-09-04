import { JSONSchemaSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import { AgentToolApprovalClassSchema } from './app-lifecycle.js';
import { MCPToolAnnotationsSchema } from './apps.js';

// The unified project-scoped tool registry as `GET /tools` and `POST /tools/validate` publish it.
//
// `//` rather than `/** */` throughout: a JSDoc block immediately preceding an exported declaration
// is picked up by the OpenAPI scanner and published as that component's `description`, which would
// double up with the `description` stated in `.meta()`.

export const ToolSourceSchema = z.enum(['builtin', 'app', 'interaction']).meta({
    id: 'ToolSource',
    description:
        'Origin of a tool in the unified project-scoped tool registry.\n\n- `builtin`: anything statically registered on the worker — workflow builtins, studio agent tools, and sys skills\n- `app`: tools contributed by an installed app for the project\n- `interaction`: a project interaction exposed via `tag=tool` / `is_tool=true` / `is_skill=true`\n\nSkill semantics (the tool unlocks others when invoked) are NOT part of the source. They are identified universally by the `learn_` prefix in the tool name. This matches how the runtime registry stores them and avoids splitting one logical origin into two sources.',
});

export const ToolRuntimeContextSchema = z.enum(['conversation', 'process']).meta({
    id: 'ToolRuntimeContext',
    description: 'The runtime context in which a caller intends to use a tool.',
});

export const ProcessToolCompatibilityReasonSchema = z
    .enum([
        'skill_not_supported',
        'interaction_not_supported',
        'agent_not_supported',
        'confirmation_not_supported',
        'control_tool_not_supported',
        'approval_metadata_unavailable',
        'ambiguous_name',
    ])
    .meta({ id: 'ProcessToolCompatibilityReason' });

export const ProcessToolCompatibilitySchema = z
    .strictObject({
        compatible: z.boolean(),
        reason: ProcessToolCompatibilityReasonSchema.optional(),
    })
    .meta({ id: 'ProcessToolCompatibility' });

export const ValidateToolNamesPayloadSchema = z
    .strictObject({
        names: z.array(z.string()).meta({
            description:
                'Bare tool names as they appear in `agent_runner_options.tool_names`. `+`/`-` prefixes are stripped before lookup.',
        }),
    })
    .meta({ id: 'ValidateToolNamesPayload', description: 'Request payload for `POST /tools/validate`.' });

export const ToolValidationResultSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The name the caller asked about.' }),
        valid: z
            .boolean()
            .meta({ description: "True if the name resolves to exactly one tool in the project's unified registry." }),
        source: ToolSourceSchema.meta({ description: 'When `valid`: which source the tool came from.' }).optional(),
        app_install_id: z
            .string()
            .meta({ description: "When `valid` and `source === 'app'`: the app installation that provides the tool." })
            .optional(),
        app_name: z
            .string()
            .meta({ description: "When `valid` and `source === 'app'`: the app's manifest name." })
            .optional(),
        suggestion: z
            .string()
            .meta({
                description:
                    'When `!valid` and a close match exists: the suggested replacement name (Levenshtein-based).',
            })
            .optional(),
        collisions: z
            .array(
                z.strictObject({
                    source: ToolSourceSchema,
                    app_install_id: z.string().optional(),
                }),
            )
            .meta({
                description:
                    'Populated when a name appears in more than one source. Validation does not fail on this, but exposes the ambiguity so callers can surface a warning (last-write-wins resolution applies).',
            })
            .optional(),
    })
    .meta({ id: 'ToolValidationResult', description: 'Per-name resolution result for `POST /tools/validate`.' });

export const AggregatedToolSchema = z
    .strictObject({
        name: z.string().meta({
            description:
                'Name as referenced from `agent_runner_options.tool_names`. For interaction skills this is `learn_<endpoint>`.',
        }),
        source: ToolSourceSchema,
        description: z.string().optional(),
        title: z.string().optional(),
        is_default: z
            .boolean()
            .meta({
                description:
                    'Whether the tool is part of the default toolkit when no explicit `tool_names` is provided.',
            })
            .optional(),
        annotations: MCPToolAnnotationsSchema.optional(),
        approval_class: AgentToolApprovalClassSchema.optional(),
        process_compatibility: ProcessToolCompatibilitySchema.optional(),
        unlocked_tools: z
            .array(z.string())
            .meta({ description: 'For skills (`learn_*`): tool names this skill unlocks when invoked.' })
            .optional(),
        app_install_id: z
            .string()
            .meta({ description: "Present when `source === 'app'`: the app installation that provides this tool." })
            .optional(),
        app_name: z
            .string()
            .meta({
                description:
                    "Present when `source === 'app'`: the app's manifest name (used for `principal.apps` filtering).",
            })
            .optional(),
        interaction_id: z
            .string()
            .meta({ description: "Present when `source === 'interaction'`: the interaction document id." })
            .optional(),
        is_agent: z
            .boolean()
            .meta({
                description:
                    "Present when `source === 'interaction'`: true if the interaction has `agent_runner_options.is_agent === true`. Lets UI consumers distinguish sub-agents (autonomous, run-to-completion) from regular interaction tools.",
            })
            .optional(),
    })
    .meta({
        id: 'AggregatedTool',
        description:
            'A single tool entry in the unified registry, regardless of where it came from. Returned by `GET /tools` and the resolution map of `POST /tools/validate`.',
    });

export const ValidateToolNamesResponseSchema = z
    .strictObject({
        results: z
            .array(ToolValidationResultSchema)
            .meta({ description: 'One entry per requested name, in the same order.' }),
        invalid_count: z.number().min(0).meta({
            description: 'Convenience count of `results.filter(r => !r.valid).length`.',
            // `type`/`format` in meta rather than `z.int()`: the latter also emits Zod's
            // safe-integer `maximum`, which the published component does not carry.
            type: 'integer',
            format: 'int32',
        }),
    })
    .meta({ id: 'ValidateToolNamesResponse', description: 'Response from `POST /tools/validate`.' });

export const AggregatedToolArraySchema = z.array(AggregatedToolSchema).meta({ id: 'AggregatedToolArray' });

export const InspectProjectToolQuerySchema = z
    .strictObject({ context: ToolRuntimeContextSchema.optional() })
    .meta({ id: 'InspectProjectToolQuery' });

export const ToolInspectionSchema = z
    .strictObject({
        name: z.string(),
        source: ToolSourceSchema,
        description: z.string().optional(),
        title: z.string().optional(),
        input_schema: JSONSchemaSchema.optional().meta({
            description: 'Exact input schema when the provider supplied one. Omitted rather than fabricated.',
        }),
        output_schema: JSONSchemaSchema.optional().meta({
            description:
                'MCP outputSchema advertised by the provider. It does not describe the process node result transport.',
        }),
        output_contract_status: z
            .enum(['provider_supplied', 'unknown'])
            .meta({
                description:
                    'For app tools, whether the provider advertised output schema metadata. Omitted for builtin and interaction tools.',
            })
            .optional(),
        approval_class: AgentToolApprovalClassSchema.optional(),
        annotations: MCPToolAnnotationsSchema.optional(),
        app_install_id: z.string().optional(),
        app_name: z.string().optional(),
        ready: z.boolean().meta({ description: 'True only when an exact input schema was resolved.' }),
        process_compatibility: ProcessToolCompatibilitySchema.optional(),
    })
    .meta({ id: 'ToolInspection' });

// Query contracts are registry components even though the scanner expands them into parameters.
export const ListProjectToolsQuerySchema = z
    .strictObject({
        sources: z.array(ToolSourceSchema).meta({ description: 'Include only these sources.' }).optional(),
        exclude: z
            .array(ToolSourceSchema)
            .meta({
                description: 'Drop these sources from the result (and skip their fetch). Applied after `sources`.',
            })
            .optional(),
        context: ToolRuntimeContextSchema.optional(),
    })
    .meta({ id: 'ListProjectToolsQuery' });
