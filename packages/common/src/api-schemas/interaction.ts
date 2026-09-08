import {
    CompletionResultSchema,
    ExecutionTokenUsageSchema,
    JSONObjectSchema,
    JSONSchemaSchema,
    ModalitiesSchema,
    ModelOptionsSchema,
    PromptCacheDiagnosticSchema,
    PromptRoleSchema,
    StatelessExecutionOptionsSchema,
    ToolDefinitionSchema,
    ToolUseSchema,
} from '@llumiverse/common/schemas';
import { z } from 'zod';
import {
    AgentSearchScope,
    ExecutionRunStatus,
    InteractionStatus,
    ModelSource,
    RunSourceTypes,
} from '../interaction.js';
import { PromptSegmentDefType, PromptStatus, TemplateType } from '../prompt.js';
import { AgentToolApprovalModes } from '../store/agent-approval.js';
import { LlmCallType } from '../workflow-analytics.js';
import { ProjectRefSchema } from './apikey.js';
import { ExecutionEnvironmentRefSchema } from './environment.js';
import { AccountRefSchema } from './invites.js';
import { AgentCheckpointConfigurationSchema } from './project-configuration.js';
import { EditRevisionSchema, ExpectedEditRevisionSchema } from './schema-primitives.js';
import { InteractionExecutionConfigurationSchema, RunDataStorageLevelSchema } from './store.js';

/**
 * Interactions, their prompts, and the runs they produce.
 *
 * Declaration order is dependency order — a schema referenced by another is declared before it —
 * which is why this file does not read alphabetically.
 */

export const SortOrderSchema = z.enum(['asc', 'desc']).meta({ id: 'SortOrder' });

export const ExecutionRunStatusSchema = z.enum(ExecutionRunStatus).meta({ id: 'ExecutionRunStatus' });

export const FacetSpecSchema = z
    .strictObject({
        name: z.string().meta({
            description:
                'Key the buckets are returned under. `total` is reserved for the match count that every facet ' +
                'response carries, and is rejected with a 400.',
        }),
        field: z.string(),
    })
    .meta({ id: 'FacetSpec' });

export const AsyncCompletionModeSchema = z.enum(['conversation_state', 'text']).meta({ id: 'AsyncCompletionMode' });

export const ResultStorageOptionsSchema = z
    .strictObject({
        path: z.string().meta({ description: 'Full storage path for the result (e.g., "pages/doc123/page-1.md")' }),
    })
    .meta({ id: 'ResultStorageOptions', description: 'Options for storing inference results to cloud storage' });

export const LlmCallTypeSchema = z
    .enum(LlmCallType)
    .meta({ id: 'LlmCallType', description: 'Types of LLM calls in a conversation' });

export const PendingMcpConnectionSchema = z
    .strictObject({
        app_install_id: z
            .string()
            .meta({ description: 'The app installation id owning the collection (used for OAuth operations).' }),
        collection_id: z.string().meta({ description: 'The MCP tool-collection id.' }),
        name: z.string().meta({ description: 'Human-readable label for the server/collection.' }),
        description: z
            .string()
            .meta({ description: 'Manifest description of what the server provides (used for discovery).' })
            .optional(),
        namespace: z.string().meta({ description: 'Tool-name prefix for this collection.' }).optional(),
    })
    .meta({
        id: 'PendingMcpConnection',
        description:
            "An MCP server the user can connect to but hasn't yet (active + accessible, no OAuth token). Built at tool-discovery time and stored on the conversation state so the agent can discover it (by description) and ask the user to connect.",
    });

export const ModelSourceSchema = z
    .enum(ModelSource)
    .meta({ id: 'ModelSource', description: 'Source of the resolved model configuration' });

export const ResolvedEnvironmentInfoSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        provider: z.string(),
    })
    .meta({ id: 'ResolvedEnvironmentInfo', description: 'Resolved environment information' });

// `z.literal(AgentSearchScope.Collection)`, not `z.literal('collection')`: the published component
// is a `const`, and reading the value off the enum keeps the inferred type the enum member so
// callers assigning `AgentSearchScope.Collection` still type-check.
export const AgentSearchScopeSchema = z
    .literal(AgentSearchScope.Collection)
    .meta({ id: 'AgentSearchScope', description: 'Defines the scope for agent search operations.' });

export const SkillContextTriggersSchema = z
    .strictObject({
        keywords: z
            .array(z.string())
            .meta({ description: 'Keywords in user input that should trigger this skill' })
            .optional(),
        tool_names: z
            .array(z.string())
            .meta({ description: 'If these tools are being used, suggest this skill' })
            .optional(),
        data_patterns: z
            .array(z.string())
            .meta({ description: 'Regex patterns to match against input data' })
            .optional(),
    })
    .meta({
        id: 'SkillContextTriggers',
        description:
            'Context triggers for auto-injection of skills. When these conditions match, the skill is automatically injected into the agent context.',
    });

export const InteractionStatusSchema = z.enum(InteractionStatus).meta({ id: 'InteractionStatus' });

export const InteractiveChannelSchema = z
    .strictObject({
        type: z.literal('interactive'),
    })
    .meta({
        id: 'InteractiveChannel',
        description: 'Interactive (UI chat) channel configuration. Used for real-time chat interface communication.',
    });

export const EmailChannelSchema = z
    .strictObject({
        type: z.literal('email'),
        to_email: z.string().meta({ description: 'Email address to send agent messages to' }),
        thread_subject: z
            .string()
            .meta({ description: 'Subject for the email thread (without "Re:" prefix)' })
            .optional(),
        in_reply_to: z
            .string()
            .meta({ description: 'Message ID for In-Reply-To header (most recent message)' })
            .optional(),
        references: z.array(z.string()).meta({ description: 'Chain of message IDs for References header' }).optional(),
        route_key: z
            .string()
            .meta({ description: 'Short routing key for reply emails (8-char alphanumeric, stored in Redis)' })
            .optional(),
    })
    .meta({
        id: 'EmailChannel',
        description: 'Email channel configuration with threading support. Used for email-based agent communication.',
    });

export const UsedSkillSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Skill name (e.g., "analyze_data")' }),
        src: z.string().meta({
            description:
                'Source URL of the skill collection (e.g., "https://tools.vertesia.io/api/skills/data-analysis")',
        }),
        language: z.string().meta({ description: 'Programming language (e.g., "python")' }).optional(),
        packages: z.array(z.string()).meta({ description: 'Required packages (e.g., ["pandas", "numpy"])' }).optional(),
        system_packages: z
            .array(z.string())
            .meta({ description: 'System-level packages to install via sudo apt-get (e.g., ["poppler-utils"])' })
            .optional(),
    })
    .meta({ id: 'UsedSkill', description: 'Skill metadata tracked when a skill is used' });

export const ToolReferenceSchema = z
    .strictObject({
        storage_key: z.string(),
        tool_count: z.number(),
        stored_at: z.string(),
    })
    .meta({
        id: 'ToolReference',
        description:
            'Lightweight tool reference for activity payloads. References tools stored in GCP instead of embedding full tool definitions.',
    });

export const ConversationStripOptionsSchema = z
    .strictObject({
        images_after_turns: z
            .number()
            .meta({
                description:
                    'Number of turns to keep images before stripping them.\n- 0: Strip images immediately after each turn\n- N > 0: Keep images for N turns before stripping (default: 5)\n- Infinity: Never strip images',
            })
            .optional(),
        text_max_tokens: z
            .number()
            .meta({
                description:
                    'Maximum tokens for text content before truncation. Text content exceeding this limit will be truncated with a marker. Uses ~4 characters per token estimate.',
            })
            .optional(),
        heartbeats_after_turns: z
            .number()
            .meta({
                description:
                    'Number of turns to keep heartbeat messages before stripping them. Heartbeat messages are periodic workstream status updates wrapped in `<heartbeat>...</heartbeat>` tags that clutter conversation history.\n- 0: Strip heartbeats immediately after each turn\n- 1 (default): Keep only the most recent heartbeat\n- N > 0: Keep heartbeats for N turns before stripping\n- Infinity: Never strip heartbeats',
            })
            .optional(),
    })
    .meta({
        id: 'ConversationStripOptions',
        description:
            'Configuration for stripping large data from conversation history to prevent JSON serialization issues and reduce storage bloat.',
    });

export const PlanTaskSchema = z
    .strictObject({
        id: z.number(),
        goal: z.string(),
        instructions: z.array(z.string()).optional(),
        comment: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
    })
    .meta({ id: 'PlanTask' });

export const WorkflowAncestorSchema = z
    .strictObject({
        run_id: z.string(),
        workflow_id: z.string(),
        run_depth: z.number().meta({ description: 'the depth of nested parent workflows' }),
    })
    .meta({ id: 'WorkflowAncestor' });

export const TextArtifactReferenceSchema = z
    .strictObject({
        storage_id: z.string(),
        artifact_path: z.string(),
        display_ref: z.string(),
        sha256: z.string(),
        size_bytes: z.number(),
        content_type: z.string(),
    })
    .meta({
        id: 'TextArtifactReference',
        description: 'Reference to text content externalized to agent artifact storage.',
    });

export const AgentResourceActionSchema = z.enum(['created', 'updated', 'deleted']).meta({ id: 'AgentResourceAction' });

export const AgentResourceTypeSchema = z
    .enum([
        'document',
        'collection',
        'content_type',
        'interaction',
        'prompt',
        'agent',
        'workflow',
        'process',
        'process_run',
        'interaction_run',
        'view',
    ])
    .meta({
        id: 'AgentResourceType',
        description:
            'The kinds of Vertesia resource an agent tool can report having created, updated, or deleted. Restricted to resources that have a real detail route to navigate to — do not emit a reference for a mutation with no meaningful navigation target. Add new kinds only once their route exists.',
    });

export const ToolApprovalGrantSchema = z
    .strictObject({
        key: z.string(),
        tool_name: z.string(),
        target: z.string().optional(),
        granted_at: z.string(),
    })
    .meta({ id: 'ToolApprovalGrant' });

// Reads its members off the const array rather than restating them, the way `SupportedProviders`
// does: `AgentToolApprovalModes` is iterated at runtime, so a second list here would be a copy that
// compiles.
export const AgentToolApprovalModeSchema = z.enum(AgentToolApprovalModes).meta({ id: 'AgentToolApprovalMode' });

export const ExecutionRunDocRefSchema = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
    })
    .meta({ id: 'ExecutionRunDocRef', description: 'The run ref is used to identify a run document in the storage' });

export const StreamingOptionsSchema = z
    .strictObject({
        redis_channel: z.string().meta({ description: 'Redis channel to publish streaming chunks to' }),
        workstream_id: z
            .string()
            .meta({ description: 'Optional workstream ID for multi-workstream agents' })
            .optional(),
    })
    .meta({ id: 'StreamingOptions', description: 'Streaming-specific options (only needed when stream=true)' });

export const TemplateTypeSchema = z.enum(TemplateType).meta({ id: 'TemplateType' });

export const ExecutionRunWorkflowSchema = z
    .strictObject({
        rate_limit_id: z
            .string()
            .meta({
                description:
                    'Stable identifier pairing an interaction rate-limit admission with its completion feedback.',
            })
            .optional(),
        run_id: z.string().meta({
            description:
                'The Temporal Workflow Run ID related to this Interaction Run.\n\nA Run ID is a globally unique, platform-level identifier for a Workflow Execution.\n\nDeprecated: For agent runs, use the Agent Runs API (`/api/v1/agents`) instead.\nThe AgentRun object provides a stable ID that survives workflow restarts.\nThis field is only relevant for legacy non-agent interaction executions.',
            deprecated: true,
            'x-deprecated-message':
                'For agent runs, use the Agent Runs API (`/api/v1/agents`) instead.\nThe AgentRun object provides a stable ID that survives workflow restarts.\nThis field is only relevant for legacy non-agent interaction executions.',
        }),
        workflow_id: z.string().meta({
            description:
                'The Temporal Workflow ID related to this Interaction Run.\n\nDeprecated: For agent runs, use the Agent Runs API (`/api/v1/agents`) instead.\nThe AgentRun object provides a stable ID that survives workflow restarts.\nThis field is only relevant for legacy non-agent interaction executions.',
            deprecated: true,
            'x-deprecated-message':
                'For agent runs, use the Agent Runs API (`/api/v1/agents`) instead.\nThe AgentRun object provides a stable ID that survives workflow restarts.\nThis field is only relevant for legacy non-agent interaction executions.',
        }),
        activity_type: z
            .string()
            .meta({
                description:
                    'The Temporal Activity Type used for executing this Interaction. Undefined if the interaction was not executed as part of a workflow (such as Agent Runner).',
            })
            .optional(),
    })
    .meta({ id: 'ExecutionRunWorkflow' });

export const SchemaRefSchema = z
    .strictObject({
        $uri: z.string(),
    })
    .meta({
        id: 'SchemaRef',
        description:
            'Schema can be stored or specified as a reference to an external schema. We only support "store:" references for now',
    });

export const RateLimitRequestResponseSchema = z
    .strictObject({
        delay_ms: z.number(),
    })
    .meta({ id: 'RateLimitRequestResponse' });

export const PromptModalitiesSchema = z
    .strictObject({
        hasVideo: z.boolean(),
        hasImage: z.boolean(),
    })
    .meta({ id: 'PromptModalities' });

export const PromptStatusSchema = z.enum(PromptStatus).meta({ id: 'PromptStatus' });

export const PromptSegmentDefTypeSchema = z.enum(PromptSegmentDefType).meta({ id: 'PromptSegmentDefType' });

export const InteractionVisibilitySchema = z.enum(['public', 'private']).meta({ id: 'InteractionVisibility' });

export const RunSourceTypesSchema = z.enum(RunSourceTypes).meta({ id: 'RunSourceTypes' });

export const InteractionExecutionErrorSchema = z
    .strictObject({
        code: z.string(),
        message: z.string(),
        data: z.unknown().optional(),
        retryable: z.boolean().optional(),
        retry_after_ms: z
            .number()
            .meta({
                description: 'Provider-supplied retry delay preserved across synchronous and async workflow execution.',
            })
            .optional(),
    })
    .meta({ id: 'InteractionExecutionError' });

export const NumberValueMapSchema = z.object({}).catchall(z.number()).meta({ id: 'NumberValueMap' });

export const InteractionsExportPayloadSchema = z
    .strictObject({
        name: z
            .string()
            .meta({
                description:
                    'The name of the interaction. If not specified all the interactions in the current project will be exported',
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        versions: z.array(z.union([z.number(), z.literal('draft'), z.literal('latest')])).optional(),
    })
    .meta({ id: 'InteractionsExportPayload' });

export const PromptTemplateSchema = z
    .strictObject({
        role: PromptRoleSchema,
        content: z.string(),
        content_type: TemplateTypeSchema,
        inputSchema: JSONSchemaSchema.optional(),
        id: z.string(),
        name: z.string(),
        status: PromptStatusSchema,
        version: z.number(),
        edit_revision: EditRevisionSchema,
        // The record this one was derived from. On a published version it is the draft it was
        // published from; on a fork it is the prompt that was forked, and the fork is itself a
        // draft. So `parent` alone does not tell you which kind of record this is — read `status`.
        parent: z.string().optional(),
        description: z.string().optional(),
        // optional test data satisfying the schema
        test_data: JSONObjectSchema.optional(),
        // cache the template output
        script: z.string().optional(),
        project: z.union([z.string(), ProjectRefSchema]),
        tags: z.array(z.string()).optional(),
        // only for drafts — when it was last published
        last_published_at: z.string().meta({ format: 'date-time' }).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'PromptTemplate' });

// The two payloads are projections of `PromptTemplate`, so they are derived from its canonical Zod
// schema here. Leaving them as TypeScript utility types would give the generator only aliases with
// no runtime properties to publish.
const SERVER_OWNED_PROMPT_FIELDS = [
    'id',
    'edit_revision',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    'project',
] as const;
const SERVER_OWNED_PROMPT_FIELD_KEYS = Object.fromEntries(
    SERVER_OWNED_PROMPT_FIELDS.map((field) => [field, true as const]),
) as Record<(typeof SERVER_OWNED_PROMPT_FIELDS)[number], true>;

// Keep the published property order stable. OpenAPI Generator uses it for required Go constructor
// arguments. Zod's `.pick()` builds the projected shape in mask order, whereas `.omit()` preserves
// the full response model's order and would change this constructor when that model is reorganized.
export const PromptTemplateCreatePayloadSchema = PromptTemplateSchema.pick({
    name: true,
    parent: true,
    description: true,
    test_data: true,
    script: true,
    tags: true,
    last_published_at: true,
    role: true,
    content: true,
    content_type: true,
    inputSchema: true,
}).meta({ id: 'PromptTemplateCreatePayload' });

export const PromptTemplateUpdatePayloadSchema = PromptTemplateSchema.omit(SERVER_OWNED_PROMPT_FIELD_KEYS)
    .partial()
    .extend({ expected_edit_revision: ExpectedEditRevisionSchema })
    .meta({ id: 'PromptTemplateUpdatePayload' });

export const CachePolicySchema = z
    .strictObject({
        type: z.enum(['cache', 'no_cache', 'cache_and_refresh']),
        refresh_probability: z.number(),
        varies_on: z.array(z.string()),
        ttl: z.number(),
    })
    .meta({ id: 'CachePolicy' });

export const InteractionPublishPayloadSchema = z
    .strictObject({
        visibility: InteractionVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
    })
    .meta({ id: 'InteractionPublishPayload' });

export const InteractionForkPayloadSchema = z
    .strictObject({
        keepTags: z.boolean().optional(),
        forkPrompts: z.boolean().optional(),
        targetProject: z.string().optional(),
    })
    .meta({ id: 'InteractionForkPayload' });

export const InteractionEndpointQuerySchema = z
    .strictObject({
        limit: z.number().optional(),
        offset: z.number().optional(),
        status: InteractionStatusSchema.optional(),
        visibility: InteractionVisibilitySchema.optional(),
        version: z.number().optional(),
        tags: z.array(z.string()).optional(),
        includes: z
            .array(z.string())
            .meta({
                description:
                    'Filter by interaction endpoint name to include only the specified endpoints\n* If both includes and excludes are specified then only the includes filter will be used.',
            })
            .optional(),
        excludes: z
            .array(z.string())
            .meta({
                description:
                    'Filter by interaction endpoint name to excludes the specified endpoints. If both includes and excludes are specified then only the includes filter will be used.',
            })
            .optional(),
        include_params_schema: z
            .boolean()
            .meta({
                description:
                    'Whether or not to return the parameters schema. The parameters schema is an array of JSON schemas. Each schema is a JSON schema that describes the parameters of an interaction prompt.',
            })
            .optional(),
        include_result_schema: z
            .boolean()
            .meta({ description: 'Whether or not to return the result schema' })
            .optional(),
        is_skill: z
            .boolean()
            .meta({ description: 'When true, filter results to only interactions with is_skill=true.' })
            .optional(),
    })
    .meta({ id: 'InteractionEndpointQuery', description: 'The payload to query the interaction endpoints' });

export const ImprovePromptPayloadConfigSchema = z
    .strictObject({
        config: InteractionExecutionConfigurationSchema,
    })
    .meta({ id: 'ImprovePromptPayloadConfig' });

export const ImprovePromptPayloadSchema = z
    .strictObject({
        config: InteractionExecutionConfigurationSchema,
        interaction_name: z.string(),
        context: z.string().optional(),
        prompt: z.array(
            z.strictObject({
                name: z.string(),
                content: z.string(),
            }),
        ),
        result_schema: JSONSchemaSchema.optional(),
    })
    .meta({ id: 'ImprovePromptPayload' });

export const GeneratedTestDataRecordSchema = z.object({}).catchall(z.unknown()).meta({ id: 'GeneratedTestDataRecord' });

export const GeneratedInteractionPromptTemplateSchema = z
    .strictObject({
        role: z.enum(['safety', 'system', 'user']),
        name: z.string(),
        content: z.string(),
        content_type: z.literal('jst'),
        inputSchema: JSONSchemaSchema,
    })
    .meta({ id: 'GeneratedInteractionPromptTemplate' });

export const GenerateTestDataPayloadSchema = z
    .strictObject({
        message: z.string().optional(),
        count: z.number().optional(),
        config: InteractionExecutionConfigurationSchema,
    })
    .meta({ id: 'GenerateTestDataPayload' });

export const GenerateInteractionPayloadSchema = z
    .strictObject({
        description: z.string(),
        config: InteractionExecutionConfigurationSchema,
    })
    .meta({ id: 'GenerateInteractionPayload' });

export const InteractionSearchQuerySchema = z
    .strictObject({
        name: z.string().optional(),
        status: z.array(z.string()).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        prompt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        version: z.string().optional(),
        model: z.string().optional(),
        environment: z.string().optional(),
        is_agent: z.boolean().optional(),
        is_tool: z.boolean().optional(),
        is_skill: z.boolean().optional(),
        is_basic: z.boolean().optional(),
        is_sub_agent: z.boolean().optional(),
    })
    .meta({ id: 'InteractionSearchQuery' });

export const AsyncExecutionResultSchema = z
    .strictObject({
        runId: z.string(),
        workflowId: z.string(),
        agentRunId: z.string().optional(),
    })
    .meta({ id: 'AsyncExecutionResult' });

// The same `const` as `AgentSearchScope`, published under a second name because the scanner names an
// indexed access into an enum this way. Reads the value off the enum for the same reason.
export const AgentSearchScope_CollectionSchema = z
    .literal(AgentSearchScope.Collection)
    .meta({ id: 'AgentSearchScope_Collection', description: 'Search is scoped to a specific collection.' });

export const InitialToolCallSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Stable identifier used to make initialization replay-safe.' }),
        tool: z.string().meta({
            description:
                'Read-only builtin activity tool name. Skills are configured separately through initial_skills.',
        }),
        input: z.looseObject({}).meta({ description: 'Tool input parameters.' }).optional(),
        on_error: z
            .enum(['fail', 'continue'])
            .meta({ description: 'Whether a failed initialization call aborts the conversation start.' })
            .optional(),
    })
    .meta({
        id: 'InitialToolCall',
        description:
            'A tool invocation executed before the first model turn of a conversation. Results are injected into the initial context so the agent starts with them in hand.',
    });

export const ConversationVisibilitySchema = z.enum(['private', 'project']).meta({ id: 'ConversationVisibility' });

export const SortOptionSchema = z
    .strictObject({
        field: z
            .string()
            .meta({ description: "Field path to sort by (e.g. 'updated_at', 'name', 'properties.title')" }),
        order: SortOrderSchema.meta({ description: "Sort direction. Defaults to 'desc'." }).optional(),
    })
    .meta({ id: 'SortOption' });

export const RunSearchQuerySchema = z
    .strictObject({
        name: z.string().optional(),
        status: ExecutionRunStatusSchema.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        interaction: z.string().optional(),
        environment: z.string().optional(),
        model: z.string().optional(),
        tags: z.array(z.string()).optional(),
        exclude_tags: z
            .array(z.string())
            .meta({
                description:
                    'Tags to exclude. Runs carrying any of these tags are filtered out of the results, counts, and facet buckets. Combined with `tags` (which requires all of the listed tags) as an additional `$nin` constraint on the same field.',
            })
            .optional(),
        query: z.string().optional(),
        default_query_path: z.string().optional(),
        parent: z.array(z.string()).optional(),
        is_root: z.boolean().optional(),
        object: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        finish_reason: z.string().optional(),
        created_by: z.string().optional(),
        workflow_run_ids: z.array(z.string()).optional(),
        workflow_ids: z.array(z.string()).optional(),
        run_ids: z.array(z.string()).optional(),
        is_agent: z.boolean().optional(),
    })
    .meta({ id: 'RunSearchQuery' });

/**
 * The filters `GET /runs` actually applies.
 *
 * Separate from {@link RunSearchQuerySchema} because the two are different contracts that happened to
 * share a name on this route. `RunSearchQuery` is the structured body of `POST /runs/search`, and
 * publishing it here advertised ten filters this endpoint has never read — `exclude_tags`,
 * `finish_reason`, `created_by`, `start`, `end`, `object`, `query`, `default_query_path`, `run_ids`
 * and `is_agent` — while omitting the `tag` and `workflow_ids` it does read. A generated client
 * following the document got silently unfiltered results.
 *
 * Every multi-valued filter is an array with `form`/`explode` serialization, which is the spelling the
 * OpenAPI compliance rules ask for and what a single `?tag=x` normalizes to. The handler additionally
 * splits each value on commas, so the long-standing `?tag=a,b` spelling keeps working; that is a
 * property of the handler rather than of the document, which cannot express it.
 *
 * `fromDate` and `toDate` are deliberately absent. The SDK sends them and the endpoint has never
 * applied them, so publishing them would restate the same kind of promise this component exists to
 * remove. They are still accepted and ignored, exactly as before.
 */
export const RunListQuerySchema = z
    .strictObject({
        limit: z.number().int().meta({ description: 'Maximum number of runs to return.' }).optional(),
        offset: z.number().int().meta({ description: 'Number of runs to skip.' }).optional(),
        interaction: z
            .array(z.string())
            .meta({ description: 'Interaction ids, or in-code interaction names, to filter by.' })
            .optional(),
        model: z.array(z.string()).meta({ description: 'Model ids to filter by.' }).optional(),
        environment: z.array(z.string()).meta({ description: 'Environment ids to filter by.' }).optional(),
        status: z.array(ExecutionRunStatusSchema).meta({ description: 'Run statuses to filter by.' }).optional(),
        tag: z.array(z.string()).meta({ description: 'Run tags to filter by.' }).optional(),
        parent: z
            .array(z.string())
            .meta({ description: 'Parent run ids to filter by. Mutually exclusive with `is_root=true`.' })
            .optional(),
        is_root: z
            .boolean()
            .meta({ description: 'Return only runs that have no parent. Mutually exclusive with `parent`.' })
            .optional(),
        workflow_run_ids: z.array(z.string()).meta({ description: 'Temporal workflow run ids.' }).optional(),
        workflow_ids: z.array(z.string()).meta({ description: 'Temporal workflow ids.' }).optional(),
    })
    .meta({ id: 'RunListQuery' });

export const StreamingTelemetryContextSchema = z
    .strictObject({
        callType: LlmCallTypeSchema.meta({
            description: 'Type of LLM call: start, resume after user message, or resume after tool results',
        }),
        attemptNumber: z.number().meta({ description: 'Activity retry attempt number' }).optional(),
        inferenceStartTime: z
            .number()
            .meta({ description: 'Timestamp when inference started (for duration calculation)' }),
    })
    .meta({
        id: 'StreamingTelemetryContext',
        description:
            'Telemetry context for streaming mode. Contains info not available in current_state needed to send LlmCallEvent.',
    });

export const ResolvedRuntimeConfigSchema = z
    .strictObject({
        environment: ResolvedEnvironmentInfoSchema,
        model: z.string().optional(),
        model_source: ModelSourceSchema,
    })
    .meta({ id: 'ResolvedRuntimeConfig', description: 'Resolved runtime configuration for an interaction' });

export const AgentRunnerOptionsSchema = z
    .strictObject({
        is_agent: z
            .boolean()
            .meta({ description: 'Whether this interaction is an agent (executable in Agent Runner).' })
            .optional(),
        is_tool: z
            .boolean()
            .meta({ description: 'Whether this interaction is available as a tool (sub-agent).' })
            .optional(),
        is_skill: z
            .boolean()
            .meta({
                description:
                    "Whether this interaction is a skill (provides instructions without execution). Skills are injected into the agent's context based on context_triggers.",
            })
            .optional(),
        context_triggers: SkillContextTriggersSchema.meta({
            description: 'Context triggers for auto-injection of this skill. Only used when is_skill is true.',
        }).optional(),
        skill_priority: z
            .number()
            .meta({
                description:
                    'Injection priority for skills (higher = more likely to be selected when multiple match). Only used when is_skill is true.',
            })
            .optional(),
        tool_names: z
            .array(z.string())
            .meta({
                description:
                    'Array of default tool names available to this agent. For interactions: defines default tools. For execution payloads: you can use + and - to add or remove from default, if no sign, then list replaces default.',
            })
            .optional(),
        search_scope: AgentSearchScopeSchema.meta({
            description:
                "On which scope should the search be applied by the search_tool. Only supports 'collection' scope or undefined for now.",
        }).optional(),
        collection_id: z
            .string()
            .meta({
                description:
                    "The ID of the collection to restrict agent operations to. When specified, the agent's search and retrieval operations are limited to documents within this collection'.",
            })
            .optional(),
        request_template: z
            .string()
            .meta({
                description:
                    'Optional user-facing template for rendering run input as the first conversation entry. Supports {{field_name}}, {{nested.field}}, {{items.0.name}}, and {{json}} placeholders resolved from the run data.',
            })
            .optional(),
        checkpoint: AgentCheckpointConfigurationSchema.meta({
            description:
                "Per-agent context checkpoint configuration. Field-wise it overrides the project's `configuration.agent.checkpoint`; a per-run `checkpoint_tokens` override still wins over both.",
        }).optional(),
    })
    .meta({
        id: 'AgentRunnerOptions',
        description:
            'Configuration options for Agent Runner functionality. These options control how interactions are exposed and executed in the Agent Runner.',
    });

export const UserChannelSchema = z
    .discriminatedUnion('type', [EmailChannelSchema, InteractiveChannelSchema])
    .meta({ id: 'UserChannel' });

export const PlanSchema = z
    .strictObject({
        plan: z.array(PlanTaskSchema),
        comment: z.string().optional(),
    })
    .meta({ id: 'Plan' });

export const ExternalizedToolInputRefSchema = z
    .strictObject({
        tool_name: z.string(),
        input_path: z.array(z.literal('content')).min(1).max(1),
        ref: TextArtifactReferenceSchema,
    })
    .meta({
        id: 'ExternalizedToolInputRef',
        description:
            'Sidecar metadata for generated tool input fields that were stored outside model-visible tool_input. Keyed by tool_use.id on ConversationState.',
    });

export const AgentResourceReferenceSchema = z
    .strictObject({
        type: AgentResourceTypeSchema,
        id: z.string().meta({ description: 'The resource id used to build its detail route.' }),
        label: z
            .string()
            .meta({ description: 'Human-readable label captured at mutation time (e.g. the document name).' }),
        action: AgentResourceActionSchema,
        revision_id: z
            .string()
            .meta({
                description: 'Set when the mutation produced a new revision, enabling a "view changes" affordance.',
            })
            .optional(),
    })
    .meta({
        id: 'AgentResourceReference',
        description:
            'A navigable reference to a resource an agent tool mutated. Tools return these as tool-result metadata (see  {@link  ToolResultMeta.resources } ); the conversation runtime promotes them onto the tool\'s completed lifecycle message so the UI can render deterministic deep links and an end-of-turn "resources changed" summary — independent of any link the model writes in prose.',
    });

export const ToolApprovalGrantMapSchema = z
    .object({})
    .catchall(ToolApprovalGrantSchema)
    .meta({ id: 'ToolApprovalGrantMap' });

export const InCodePromptSchema = z
    .strictObject({
        role: PromptRoleSchema,
        content: z.string(),
        content_type: TemplateTypeSchema,
        schema: JSONSchemaSchema.optional(),
        name: z
            .string()
            .meta({ description: 'optional name of the prompt segment. Use kebab case for prompt names' })
            .optional(),
        externalId: z
            .string()
            .meta({
                description:
                    'optional reference to an external resource if any. Used internally by the system to synchronize stored prompts with in-code prompts.',
            })
            .optional(),
    })
    .meta({ id: 'InCodePrompt' });

export const RateLimitRequestPayloadSchema = z
    .strictObject({
        interaction: z.string(),
        environment_id: z.string().optional(),
        model_id: z.string().optional(),
        workflow_run_id: z
            .string()
            .meta({
                description: 'Deprecated: Use rate_limit_id for admission/completion correlation.',
                deprecated: true,
                'x-deprecated-message': 'Use rate_limit_id for admission/completion correlation.',
            })
            .optional(),
        rate_limit_id: z
            .string()
            .meta({
                description: 'Stable per-execution admission identifier. Preferred over the legacy workflow_run_id.',
            })
            .optional(),
        modalities: PromptModalitiesSchema.optional(),
    })
    .meta({ id: 'RateLimitRequestPayload' });

export const PromptTemplateRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        role: PromptRoleSchema,
        version: z.number(),
        status: PromptStatusSchema,
        content_type: TemplateTypeSchema.optional(),
        tags: z.array(z.string()).optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'PromptTemplateRef' });

// Interaction writes may carry a populated prompt copied from an interaction response. New clients
// preserve its revision while legacy clients never sent one, so the embedded request shape accepts
// both. The standalone PromptTemplate response keeps the revision required.
export const InteractionPromptTemplateInputSchema = PromptTemplateSchema.extend({
    edit_revision: EditRevisionSchema.optional(),
}).meta({ id: 'InteractionPromptTemplateInput' });

export const RunSourceSchema = z
    .strictObject({
        type: RunSourceTypesSchema,
        label: z.string(),
        principal_type: z.enum(['user', 'oauth_access', 'group', 'apikey', 'service_account', 'agent', 'schedule']),
        principal_id: z.string(),
        client_ip: z.string(),
    })
    .meta({ id: 'RunSource' });

export const PromptSegmentDefSchema = z
    .strictObject({
        id: z.string().optional(),
        type: PromptSegmentDefTypeSchema,
        template: z.union([z.string(), PromptTemplateSchema, PromptTemplateRefSchema]).optional(),
        configuration: z.unknown().optional(),
    })
    .meta({ id: 'PromptSegmentDef' });

export const InteractionPromptSegmentInputSchema = PromptSegmentDefSchema.extend({
    template: z
        .union([z.string(), PromptTemplateSchema, InteractionPromptTemplateInputSchema, PromptTemplateRefSchema])
        .optional(),
}).meta({ id: 'InteractionPromptSegmentInput' });

export const InteractionEndpointSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        endpoint: z.string(),
        description: z.string().optional(),
        status: InteractionStatusSchema,
        visibility: InteractionVisibilitySchema.optional(),
        version: z.number(),
        tags: z.array(z.string()),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        result_schema: JSONSchemaSchema.optional(),
        params_schema: JSONSchemaSchema.optional(),
    })
    .meta({ id: 'InteractionEndpoint', description: 'A description of an interaction endpoint.' });

export const InteractionCreatePayloadSchema = z
    .strictObject({
        status: InteractionStatusSchema,
        test_data: JSONObjectSchema.optional(),
        interaction_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        cache_policy: CachePolicySchema.optional(),
        prompts: z.array(InteractionPromptSegmentInputSchema),
        last_published_at: z.string().meta({ format: 'date-time' }).optional(),
        name: z.string(),
        description: z.string().optional(),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        environment: z.union([z.string(), ExecutionEnvironmentRefSchema]).optional(),
        model: z.string().optional(),
        model_options: ModelOptionsSchema.optional(),
        store_media_results: z.boolean().optional(),
        restriction: RunDataStorageLevelSchema.optional(),
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        visibility: InteractionVisibilitySchema.optional(),
        tags: z.array(z.string()).optional(),
    })
    .meta({ id: 'InteractionCreatePayload' });

export const InteractionSchema = z
    .strictObject({
        id: z.string(),
        edit_revision: EditRevisionSchema,
        name: z.string(),
        endpoint: z.string(),
        description: z.string().optional(),
        project: z.union([z.string(), ProjectRefSchema]),
        tags: z.array(z.string()),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        environment: z.union([z.string(), ExecutionEnvironmentRefSchema]).optional(),
        model: z.string().optional(),
        model_options: ModelOptionsSchema.optional(),
        store_media_results: z.boolean().optional(),
        restriction: RunDataStorageLevelSchema.optional(),
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        status: InteractionStatusSchema,
        parent: z.string().optional(),
        visibility: InteractionVisibilitySchema,
        version: z.number(),
        test_data: JSONObjectSchema.optional(),
        interaction_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        cache_policy: CachePolicySchema.optional(),
        prompts: z.array(PromptSegmentDefSchema),
        last_published_at: z.string().meta({ format: 'date-time' }).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'Interaction' });

export const GeneratedTestDataRecordArraySchema = z
    .array(GeneratedTestDataRecordSchema)
    .meta({ id: 'GeneratedTestDataRecordArray' });

export const GeneratedInteractionPromptSegmentSchema = z
    .strictObject({
        type: z.literal('template'),
        template: GeneratedInteractionPromptTemplateSchema,
    })
    .meta({ id: 'GeneratedInteractionPromptSegment' });

export const ComputeInteractionFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: InteractionSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputeInteractionFacetPayload' });

export const CatalogInteractionRefSchema = z
    .strictObject({
        type: z.enum(['sys', 'app', 'stored', 'draft']).meta({ description: 'The type of interaction' }),
        id: z.string().meta({ description: 'the interaction id that can be used to execute the interaction.' }),
        name: z.string().meta({
            description:
                'The interaction name which identify the interaction in the provider interaction list. For the stored interactions this is the same as the endpoint property. For other types of interactions this is the local name of the interaction.',
        }),
        version: z
            .number()
            .meta({
                description:
                    'Only applies for stored interactions. The version of the interaction. Undefined for non stored interactions',
            })
            .optional(),
        published: z
            .boolean()
            .meta({ description: 'Only applies for stored interactions. Whether the interaction is published or not.' })
            .optional(),
        tags: z.array(z.string()).meta({ description: 'The tags associated with the interaction.' }),
        agent_runner_options: AgentRunnerOptionsSchema.meta({
            description: 'Agent Runner configuration options.',
        }).optional(),
        title: z.string().meta({ description: 'The name of the interaction. For display purposes only.' }),
        description: z.string().meta({ description: 'Optional description of the interaction.' }).optional(),
    })
    .meta({
        id: 'CatalogInteractionRef',
        description:
            'Reference to an interaction in the catalog. Used in catalog listing. The id is composed of the namespace and the interaction name. Stored interactions can use `oid:` prefix. If no prefix is used it fallback on `oid:`.',
    });

export const InCodeInteractionSchema = z
    .strictObject({
        type: z.enum(['sys', 'app', 'stored', 'draft']).meta({ description: 'The interaction type.' }),
        id: z.string().meta({ description: 'The executable catalog interaction ID.' }),
        name: z.string().meta({ description: 'The interaction code name.' }),
        version: z.number().optional(),
        published: z.boolean().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        output_modality: ModalitiesSchema.optional(),
        storage: RunDataStorageLevelSchema.optional(),
        tags: z.array(z.string()).optional(),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        model_options: ModelOptionsSchema.optional(),
        prompts: z.array(InCodePromptSchema),
        externalId: z.string().optional(),
        runtime: z
            .strictObject({
                environment: z.string().optional(),
                model: z.string().optional(),
            })
            .optional(),
    })
    .meta({
        id: 'InCodeInteraction',
        description: 'An executable interaction definition, including the prompt schemas required by clients.',
    });

export const ResolvedCatalogInteractionSchema = InCodeInteractionSchema.extend({
    title: z.string().meta({ description: 'Display title, normalized from the interaction name when absent.' }),
    tags: z.array(z.string()).meta({ description: 'Tags, normalized to an empty array when absent.' }),
}).meta({
    id: 'ResolvedCatalogInteraction',
    description: 'A catalog interaction resolved to its complete executable definition.',
});

export const RunSearchPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema).optional(),
        limit_facets: z
            .boolean()
            .meta({
                description:
                    'If the facets should be limited to the current page of results. Defaults to false. When false, the facets are independent of the search results page.',
            })
            .optional(),
        query: RunSearchQuerySchema.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        select: z.string().optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
        sort: z
            .array(SortOptionSchema)
            .meta({
                description: 'Sort criteria. Multiple entries enable multi-field sorting (first entry is primary).',
            })
            .optional(),
        aggs: z
            .looseObject({})
            .meta({
                description:
                    'Arbitrary Elasticsearch aggregation definitions. Ignored when search falls back to MongoDB.',
            })
            .optional(),
    })
    .meta({ id: 'RunSearchPayload' });

export const ResolvedInteractionExecutionInfoSchema = z
    .strictObject({
        id: z.string().meta({ description: 'The resolved interaction ID' }),
        name: z.string().meta({ description: 'The interaction endpoint name' }),
        version: z.number().meta({ description: 'The interaction version number' }),
        status: InteractionStatusSchema.meta({ description: 'The interaction status (draft or published)' }),
        tags: z
            .array(z.string())
            .meta({ description: 'The interaction tags (can include version tags like "production", "staging")' }),
        agent_runner_options: AgentRunnerOptionsSchema.meta({
            description:
                "Agent runner configuration (tool_names opt-ins, is_agent, is_tool, etc.). Included on resolve so non-UI callers (worker activities) can pick up the interaction's defaults without a second retrieve round-trip — and so in-code interactions (sys:, app:) which have no Mongo document work the same as stored ones.",
        }).optional(),
        resolved: ResolvedRuntimeConfigSchema.meta({ description: 'The resolved runtime configuration' }),
    })
    .meta({
        id: 'ResolvedInteractionExecutionInfo',
        description:
            'Resolved execution info for an interaction. Contains the interaction ID, basic metadata, and the resolved runtime configuration (environment, model) that would be used at execution time.',
    });

export const ExternalizedToolInputRefsSchema = z
    .object({})
    .catchall(z.array(ExternalizedToolInputRefSchema))
    .meta({ id: 'ExternalizedToolInputRefs' });

// `looseObject`, and it is load-bearing rather than cosmetic: the description below says "an open
// record", the published component omits `additionalProperties` accordingly, and the TypeScript
// alias has to say the same thing. A plain `object` emits identically but infers a CLOSED type, so
// the one caller passing an MCP `_meta` through would stop compiling against a contract that
// explicitly accepts it.
export const ToolResultMetaSchema = z
    .looseObject({
        resources: z
            .array(AgentResourceReferenceSchema)
            .meta({ description: 'Resources this tool created/updated/deleted, surfaced as deep links in the UI.' })
            .optional(),
    })
    .meta({
        id: 'ToolResultMeta',
        description:
            'Metadata a tool executor may attach to its result. Kept as an open record for forward compatibility while typing the fields the runtime interprets.',
    });

export const PromptImprovementResponseSchema = z
    .strictObject({
        result: z.array(CompletionResultSchema),
    })
    .meta({ id: 'PromptImprovementResponse' });

export const PromptSegmentRef_PromptTemplateRefSchema = z
    .strictObject({
        id: z.string(),
        type: PromptSegmentDefTypeSchema,
        template: PromptTemplateRefSchema.optional(),
        configuration: z.unknown().optional(),
    })
    .meta({ id: 'PromptSegmentRef_PromptTemplateRef' });

export const InteractionUpdatePayloadSchema = z
    .strictObject({
        expected_edit_revision: ExpectedEditRevisionSchema,
        status: InteractionStatusSchema.optional(),
        parent: z.string().optional(),
        visibility: InteractionVisibilitySchema.optional(),
        version: z.number().optional(),
        test_data: JSONObjectSchema.optional(),
        interaction_schema: z.union([JSONSchemaSchema, SchemaRefSchema]).optional(),
        cache_policy: CachePolicySchema.optional(),
        prompts: z.array(InteractionPromptSegmentInputSchema).optional(),
        last_published_at: z.string().meta({ format: 'date-time' }).optional(),
        name: z.string().optional(),
        endpoint: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        environment: z.union([z.string(), ExecutionEnvironmentRefSchema]).optional(),
        model: z.string().optional(),
        model_options: ModelOptionsSchema.optional(),
        store_media_results: z.boolean().optional(),
        restriction: RunDataStorageLevelSchema.optional(),
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
    })
    .meta({ id: 'InteractionUpdatePayload' });

export const InteractionEndpointArraySchema = z
    .array(InteractionEndpointSchema)
    .meta({ id: 'InteractionEndpointArray' });

export const InteractionArraySchema = z.array(InteractionSchema).meta({ id: 'InteractionArray' });

export const GeneratedInteractionDefinitionSchema = z
    .strictObject({
        name: z.string(),
        description: z.string(),
        temperature: z.number(),
        prompts: z.array(GeneratedInteractionPromptSegmentSchema),
        max_tokens: z.number().optional(),
        result_schema: JSONSchemaSchema,
        tags: z.array(z.enum(['generated', 'agent'])),
    })
    .meta({ id: 'GeneratedInteractionDefinition' });

export const CatalogInteractionRefArraySchema = z
    .array(CatalogInteractionRefSchema)
    .meta({ id: 'CatalogInteractionRefArray' });

export const ToolResultSchema = z
    .strictObject({
        content: z.string(),
        content_ref: TextArtifactReferenceSchema.meta({
            description:
                'Reference to text content stored outside Temporal/API payloads. Servers that execute the next model turn should resolve this before constructing the provider prompt.',
        }).optional(),
        is_error: z.boolean(),
        files: z.array(z.string()).optional(),
        display_message: z
            .string()
            .meta({
                description:
                    'Optional message to display in the UI instead of the content. Use this when the content is large or technical (e.g., document text) and you want to show a friendly message to the user.',
            })
            .optional(),
        meta: ToolResultMetaSchema.meta({
            description: 'Can contain metadata returned by the tool executor.',
        }).optional(),
        tool_use_id: z.string(),
        thought_signature: z
            .string()
            .meta({
                description:
                    'Gemini thinking models require thought_signature to be passed back with tool results. Copy this from the ToolUse.thought_signature that requested this tool call.',
            })
            .optional(),
    })
    .meta({ id: 'ToolResult' });

export const InteractionRefSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        endpoint: z.string(),
        parent: z.string().optional(),
        model: z.string().optional(),
        description: z.string().optional(),
        status: InteractionStatusSchema,
        visibility: InteractionVisibilitySchema.optional(),
        version: z.number(),
        tags: z.array(z.string()),
        agent_runner_options: AgentRunnerOptionsSchema.optional(),
        prompts: z.array(PromptSegmentRef_PromptTemplateRefSchema).optional(),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'InteractionRef' });

// An alias component: `ExecutionRunInteraction` publishes as `$ref: InteractionRef`, and the TS
// type is the same alias. The description belongs HERE rather than on the one property that uses
// it — re-stating an id at a use site is what `toJSONSchema` rejects as a duplicate id, and a clone
// carrying only a description loses the id and inlines the whole `InteractionRef` body instead.
export const ExecutionRunInteractionSchema = InteractionRefSchema.meta({
    id: 'ExecutionRunInteraction',
    description:
        'Interaction reference. Stored interactions may be populated as full Interaction documents; in-code interactions are represented as refs whose `id` is the namespaced interaction id.',
});

export const InteractionTagsSchema = z
    .strictObject({
        tag: z.string(),
        count: z.number(),
        interactions: z.array(InteractionRefSchema),
    })
    .meta({ id: 'InteractionTags' });

export const InteractionRefArraySchema = z.array(InteractionRefSchema).meta({ id: 'InteractionRefArray' });

// The name picker's shape, and the whole of it. `GET /interactions/names` exists to fill a select box
// from a projection of two fields, so it publishes those two rather than an `InteractionRef` whose
// other required properties the endpoint deliberately does not read. The document used to claim a
// full `Interaction` here, which no caller could rely on and the SDK already contradicted.
export const InteractionNameSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
    })
    .meta({
        id: 'InteractionName',
        description: 'An interaction reduced to the fields a name picker needs.',
    });

export const InteractionNameArraySchema = z.array(InteractionNameSchema).meta({ id: 'InteractionNameArray' });

// What `POST /interactions/export` puts in each prompt segment. The export populates its templates
// with `inputSchema` alone — it is exporting definitions, not rendering them — so this is a template
// id and its input schema rather than the `PromptTemplateRef` the other segment shapes carry.
export const ExportedPromptTemplateRefSchema = z
    .strictObject({
        id: z.string(),
        inputSchema: JSONSchemaSchema.optional(),
    })
    .meta({
        id: 'ExportedPromptTemplateRef',
        description: 'A prompt template reduced to the input schema an export carries.',
    });

export const PromptSegmentRef_ExportedPromptTemplateRefSchema = z
    .strictObject({
        id: z.string(),
        type: PromptSegmentDefTypeSchema,
        template: ExportedPromptTemplateRefSchema.optional(),
        configuration: z.unknown().optional(),
    })
    .meta({ id: 'PromptSegmentRef_ExportedPromptTemplateRef' });

// The export shape: an `InteractionRef` plus the result schema, with prompt templates reduced as
// above. Modelled here rather than derived from the `InteractionRefWithSchema` interface, which is
// declared as `Omit<InteractionRef, 'prompts'>` — an `Omit` over a canonical alias that the schema
// generator cannot resolve, since the alias publishes as a bare reference with no members to omit.
export const InteractionRefWithSchemaSchema = InteractionRefSchema.extend({
    result_schema: JSONSchemaSchema.optional(),
    prompts: z.array(PromptSegmentRef_ExportedPromptTemplateRefSchema).optional(),
}).meta({
    id: 'InteractionRefWithSchema',
    description: 'An interaction reference carrying the schemas an export needs to reconstruct it.',
});

export const InteractionRefWithSchemaArraySchema = z
    .array(InteractionRefWithSchemaSchema)
    .meta({ id: 'InteractionRefWithSchemaArray' });

export const GeneratedInteractionDefinitionArraySchema = z
    .array(GeneratedInteractionDefinitionSchema)
    .meta({ id: 'GeneratedInteractionDefinitionArray' });

export const PendingToolApprovalResultsSchema = z
    .strictObject({
        results: z.array(ToolResultSchema),
        reason: z.enum(['denied', 'denied_with_feedback', 'timeout', 'reviewer_denied']),
        message: z.string(),
        created_at: z.string(),
    })
    .meta({ id: 'PendingToolApprovalResults' });

// Self-referential through `parent`, so the reference goes through a getter — the same shape
// `JSONSchemaSchema` uses. The explicit annotation is what stops `tsc` reporting the initializer as
// implicitly `any`; `z.ZodType` rather than an inferred type because inference cannot bottom out on
// a cycle.
export const ExecutionRunSchema: z.ZodType = z
    .strictObject({
        id: z.string(),
        get parent() {
            return z
                .union([z.string(), ExecutionRunSchema])
                .meta({
                    description:
                        'Only used by runs that were created by a virtual run to point toward the virtual run parent',
                })
                .optional();
        },
        evaluation: z
            .strictObject({
                score: z.number().optional(),
                selected: z.boolean().optional(),
                scores: NumberValueMapSchema.optional(),
            })
            .optional(),
        result: z.array(CompletionResultSchema),
        parameters: z.unknown().meta({
            description:
                'The parameters used to create the interaction. If the parameters contains the special property "@memory" it will be used to locate a memory pack and the other properties will be used as the memory pack mapping.',
        }),
        tags: z.array(z.string()).optional(),
        interaction: ExecutionRunInteractionSchema.optional(),
        environment: ExecutionEnvironmentRefSchema.meta({
            description: 'Environment reference - populated with full object in API responses',
        }),
        modelId: z.string().optional(),
        result_schema: JSONSchemaSchema.optional(),
        ttl: z.number(),
        status: ExecutionRunStatusSchema,
        finish_reason: z.string().optional(),
        prompt: z.unknown().optional(),
        token_use: ExecutionTokenUsageSchema.optional(),
        prompt_cache_diagnostics: z.array(PromptCacheDiagnosticSchema).optional(),
        chunks: z.number().optional(),
        execution_time: z.number().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        account: AccountRefSchema,
        project: ProjectRefSchema,
        config: InteractionExecutionConfigurationSchema,
        error: InteractionExecutionErrorSchema.optional(),
        source: RunSourceSchema,
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description:
                'The Vertesia Workflow related to this Interaction Run.\n\nThis is only set when the interaction is executed as part of a workflow.',
        }).optional(),
    })
    .meta({ id: 'ExecutionRun' });

export const InteractionTagsArraySchema = z.array(InteractionTagsSchema).meta({ id: 'InteractionTagsArray' });

export const InteractionExecutionResultSchema = z
    .strictObject({
        id: z.string(),
        parent: z
            .union([z.string(), ExecutionRunSchema])
            .meta({
                description:
                    'Only used by runs that were created by a virtual run to point toward the virtual run parent',
            })
            .optional(),
        evaluation: z
            .strictObject({
                score: z.number().optional(),
                selected: z.boolean().optional(),
                scores: NumberValueMapSchema.optional(),
            })
            .optional(),
        result: z.array(CompletionResultSchema),
        parameters: z.looseObject({}).meta({
            description:
                'The parameters used to create the interaction. If the parameters contains the special property "@memory" it will be used to locate a memory pack and the other properties will be used as the memory pack mapping.',
        }),
        tags: z.array(z.string()).optional(),
        environment: ExecutionEnvironmentRefSchema.meta({
            description: 'Environment reference - populated with full object in API responses',
        }),
        modelId: z.string().optional(),
        result_schema: JSONSchemaSchema.optional(),
        ttl: z.number(),
        status: ExecutionRunStatusSchema,
        finish_reason: z.string().optional(),
        prompt: z.unknown().optional(),
        token_use: ExecutionTokenUsageSchema.optional(),
        prompt_cache_diagnostics: z.array(PromptCacheDiagnosticSchema).optional(),
        chunks: z.number().optional(),
        execution_time: z.number().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        config: InteractionExecutionConfigurationSchema,
        error: InteractionExecutionErrorSchema.optional(),
        source: RunSourceSchema,
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description:
                'The Vertesia Workflow related to this Interaction Run.\n\nThis is only set when the interaction is executed as part of a workflow.',
        }).optional(),
        account: z.string(),
        project: z.string(),
        interaction: z.string().optional(),
        tool_use: z.array(ToolUseSchema).optional(),
        conversation: z.unknown().optional(),
        options: StatelessExecutionOptionsSchema.optional(),
    })
    .meta({ id: 'InteractionExecutionResult' });

/**
 * The run-with-result shape as the retrieve endpoints return it.
 *
 * One property apart from {@link InteractionExecutionResultSchema}, and it is the one the retrieve
 * path populates: `GET /runs/{runId}` resolves `interaction` into a full reference, where the create
 * path leaves the stored id. Publishing both under a single component would mean a string-or-object
 * union that no generated client can deserialize into one type.
 *
 * `account` and `project` stay plain ids in both, because neither path populates them.
 */
export const PopulatedExecutionRunResultSchema = InteractionExecutionResultSchema.extend({
    interaction: ExecutionRunInteractionSchema.optional(),
}).meta({
    id: 'PopulatedExecutionRunResult',
    description: 'An execution run with its completion result and its interaction reference populated.',
});

/**
 * Stored run fields returned by the internal `/runs/find` projection endpoint.
 * Callers choose an arbitrary MongoDB projection, so every field is optional and references remain ids.
 */
export const FindRunResultSchema = InteractionExecutionResultSchema.omit({
    tool_use: true,
    conversation: true,
    options: true,
})
    .extend({
        environment: z.string(),
    })
    .partial()
    .meta({
        id: 'FindRunResult',
        description:
            'A caller-selected subset of canonical stored run fields. Internal persistence fields are normalized at the API boundary.',
    });

export const FindRunResultArraySchema = z.array(FindRunResultSchema).meta({ id: 'FindRunResultArray' });

/**
 * `result` in the shape the pre-`COMPLETION_RESULT_V1` endpoints report it.
 *
 * The legacy conversion collapses the `CompletionResult[]` into whichever single value the parts
 * amount to: the JSON object when the run produced one, the joined text otherwise, and `null` when
 * the run stored an explicit null. Published as a raw value rather than an object-or-string union,
 * which is the representation the OpenAPI compliance rules ask for and the only one a generated
 * client can hold in a single field.
 *
 * Both legacy components exist to describe endpoints we intend to remove, not to invite new callers.
 * Until then the document says what they return: it used to name a component with no `result`
 * property at all, so a generated client dropped the entire payload of these operations.
 *
 * Named for the run rather than after the `LegacyInteractionExecutionResult` interface in
 * `../interaction.js`, which is generic over its parameter type and so cannot become an alias of
 * anything inferred here. Two names for one shape is worse than one name that says what it is.
 */
const LEGACY_RESULT = z.unknown().meta({
    description:
        'The completion result collapsed to a single value: the parsed JSON object when the run produced one, the joined text otherwise. Superseded by the `result` array of the current API version.',
});

export const LegacyExecutionRunResultSchema = InteractionExecutionResultSchema.extend({
    result: LEGACY_RESULT,
}).meta({
    id: 'LegacyExecutionRunResult',
    description: 'An execution run whose completion result is reported in the pre-versioning format.',
});

export const LegacyPopulatedExecutionRunResultSchema = PopulatedExecutionRunResultSchema.extend({
    result: LEGACY_RESULT,
}).meta({
    id: 'LegacyPopulatedExecutionRunResult',
    description:
        'A retrieved execution run whose completion result is reported in the pre-versioning format. A run that has no result yet is returned unchanged, so `result` may still hold the current array form.',
});

export const ExecutionRunRefSchema = z
    .strictObject({
        id: z.string(),
        parent: z
            .union([z.string(), ExecutionRunSchema])
            .meta({
                description:
                    'Only used by runs that were created by a virtual run to point toward the virtual run parent',
            })
            .optional(),
        evaluation: z
            .strictObject({
                score: z.number().optional(),
                selected: z.boolean().optional(),
                scores: NumberValueMapSchema.optional(),
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        environment: z.union([ExecutionEnvironmentRefSchema, z.string(), z.null()]).meta({
            description:
                'Environment reference. API responses normally contain the populated environment object; the ' +
                'stored environment ID or null is retained when the referenced environment no longer exists.',
        }),
        modelId: z.string().optional(),
        result_schema: JSONSchemaSchema.optional(),
        ttl: z.number(),
        status: ExecutionRunStatusSchema,
        finish_reason: z.string().optional(),
        prompt: z.unknown().optional(),
        token_use: ExecutionTokenUsageSchema.optional(),
        prompt_cache_diagnostics: z.array(PromptCacheDiagnosticSchema).optional(),
        chunks: z.number().optional(),
        execution_time: z.number().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
        account: AccountRefSchema,
        project: ProjectRefSchema,
        config: InteractionExecutionConfigurationSchema,
        error: InteractionExecutionErrorSchema.optional(),
        source: RunSourceSchema,
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        created_by: z.string(),
        updated_by: z.string(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description:
                'The Vertesia Workflow related to this Interaction Run.\n\nThis is only set when the interaction is executed as part of a workflow.',
        }).optional(),
        interaction: InteractionRefSchema.optional(),
        result: z.array(CompletionResultSchema).optional(),
        parameters: z.unknown().optional(),
    })
    .meta({ id: 'ExecutionRunRef' });

export const ConversationStateSchema = z
    .strictObject({
        run: ExecutionRunDocRefSchema.meta({ description: 'A reference to the run that started the conversation' }),
        environment: z.string().meta({ description: 'The execution environment with provider info for LLM calls.' }),
        options: StatelessExecutionOptionsSchema.meta({ description: 'The options to use on the next call.' }),
        tool_use: z.array(ToolUseSchema).meta({ description: 'The tools to call next.' }).optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'Effective side-effecting tool approval mode for this interactive conversation.',
        }).optional(),
        tool_approval_grants: ToolApprovalGrantMapSchema.meta({
            description: 'Run-scoped, exact-target grants created by "allow this action for this run".',
        }).optional(),
        pending_tool_approval_results: PendingToolApprovalResultsSchema.meta({
            description: 'Buffered tool results held while approval denial pauses until the next user message.',
        }).optional(),
        latest_user_message: z
            .string()
            .meta({ description: 'Compact, redacted latest user intent for reviewer-style system interactions.' })
            .optional(),
        tool_input_refs: ExternalizedToolInputRefsSchema.meta({
            description:
                'Transport sidecar for large generated tool input fields.\n\nThese refs are intentionally kept out of tool_use.tool_input so they are not shown to the model. Tool execution hydrates them from artifact storage immediately before activity validation.',
        }).optional(),
        output: z.array(CompletionResultSchema).meta({ description: 'The output of the this conversation step' }),
        token_usage: ExecutionTokenUsageSchema.meta({
            description: 'The token usage of the this conversation step',
        }).optional(),
        parent: WorkflowAncestorSchema.meta({
            description: "If a sub workflow execution, contains the parent's info",
        }).optional(),
        ancestors: z
            .array(WorkflowAncestorSchema)
            .meta({ description: 'Full ancestry chain from root to immediate parent (for hierarchical aggregation)' }),
        task_id: z
            .string()
            .meta({ description: 'If part of a larger agentic workflow, task id of this task' })
            .optional(),
        plan: PlanSchema.meta({
            description: 'Stores the most recent plan for reference by plan-related tools',
        }).optional(),
        debug: z.boolean().meta({ description: 'Debug mode (more logs and persisted artifacts)' }).optional(),
        strip_options: ConversationStripOptionsSchema.meta({
            description:
                'Configuration for stripping large data from conversation history. Passed to llumiverse ExecutionOptions.stripImagesAfterTurns.',
        }).optional(),
        conversation_artifacts_base_url: z.string().meta({ description: 'Conversation artifacts base url' }).optional(),
        tool_reference: ToolReferenceSchema.meta({
            description: 'Reference to tools stored in GCP instead of embedding full tool definitions',
        }).optional(),
        tool_catalog_storage_id: z
            .string()
            .meta({ description: 'Artifact-storage scope containing the referenced tool catalog.' })
            .optional(),
        active_tool_names: z
            .array(z.string())
            .meta({
                description:
                    'Names of currently active tools (base + unlocked). Tool definitions loaded from tool_reference.',
            })
            .optional(),
        pinned_tool_names: z
            .array(z.string())
            .meta({ description: 'Active tools that should not be evicted by bounded active-tool pruning.' })
            .optional(),
        used_skills: z
            .array(UsedSkillSchema)
            .meta({
                description:
                    'Skills that have been used in this conversation (for auto-syncing scripts and package installation)',
            })
            .optional(),
        streaming_enabled: z
            .boolean()
            .meta({ description: 'Whether to stream LLM responses to Redis (cached from project config)' })
            .optional(),
        checkpoint_threshold: z
            .number()
            .meta({
                description:
                    "Project-configured checkpoint threshold as a fraction of the model's context window (cached from project.configuration.agent_checkpoint_threshold at conversation start).",
            })
            .optional(),
        checkpoint_tokens: z
            .number()
            .meta({
                description:
                    'Project-configured checkpoint hard cap in tokens (cached from project.configuration.agent_checkpoint_tokens at conversation start). The workflow resolves the effective threshold from these, the per-run checkpoint_tokens override, and the model-based default.',
            })
            .optional(),
        user_channels: z
            .array(UserChannelSchema)
            .meta({
                description:
                    'Active communication channels with their current state. Channels can be updated as conversation progresses (e.g., email threading info).',
            })
            .optional(),
        resolvedInteraction: ResolvedInteractionExecutionInfoSchema.meta({
            description:
                'The resolved interaction execution info. Contains interaction ID, name, version, and environment details.',
        }).optional(),
        end_conversation: z
            .strictObject({
                final_result: z.string().optional(),
                status: z.enum(['success', 'failure']).optional(),
                reason: z.string().optional(),
            })
            .meta({
                description:
                    'End conversation metadata set when end_conversation tool is called. Signals the workflow to terminate gracefully.',
            })
            .optional(),
        unlocked_tools: z
            .array(z.string())
            .meta({
                description:
                    'Tools that have been unlocked by skills during the conversation. These tools were initially hidden (default: false) but became available when a skill with tools was called.',
            })
            .optional(),
        latest_activity_id: z
            .string()
            .meta({
                description:
                    'Activity ID from the latest LLM call (for deduplication with streamed content). Set by streamToRedis when completing async activities.',
            })
            .optional(),
        latest_streaming_id: z
            .string()
            .meta({
                description:
                    'Stable streaming ID from the latest LLM call. Unlike Temporal activity IDs, this is scoped to the concrete workflow run that produced the stream, so it remains safe across continue-as-new.',
            })
            .optional(),
        skill_instructions_delivered: z
            .array(z.string())
            .meta({
                description:
                    'Names of skills whose full instructions are already present in the live conversation history (i.e. were delivered by a prior `learn_<skill>` call). Used to make skill re-activation idempotent: a repeat call returns a short "already active" acknowledgement instead of re-dumping the instructions.\n\nUnlike `unlocked_tools` (which must survive a checkpoint so tools stay unlocked), this list tracks only instructions present in the current compacted conversation. Checkpoints restore active builtin skill bodies and preserve their names; skills that cannot be restored are removed so the next call can re-deliver them.',
            })
            .optional(),
        initialization_call_ids: z
            .array(z.string())
            .meta({ description: 'Stable ids of initialization tool calls completed before the first model turn.' })
            .optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this conversation. `undefined`/empty means all installed/connected MCP collections are active. Updated mid-conversation via the MCP config signal; consumed when tools are re-discovered.',
            })
            .optional(),
        pending_mcp_connections: z
            .array(PendingMcpConnectionSchema)
            .meta({
                description:
                    'MCP servers that are active (not disabled) and accessible to the user but not yet OAuth-connected. Surfaced to the agent (via discover_tools) so it can offer to connect.',
            })
            .optional(),
        active_activity_group_id: z
            .string()
            .meta({
                description:
                    'Current activity group ID for internal tool-execution progress messages. All updates emitted during one tool-execution cycle should share this ID.',
            })
            .optional(),
        finish_reason: z
            .string()
            .meta({ description: 'LLM stop reason from the latest call (e.g., "stop", "length", "tool_use")' })
            .optional(),
        agent_run_id: z
            .string()
            .meta({
                description:
                    'The AgentRun ID (MongoDB _id) that owns this conversation. Used for artifact storage paths: agents/{agent_run_id}/ Undefined for legacy workflows started before the AgentRun system.',
            })
            .optional(),
        launch_id: z
            .string()
            .meta({
                description:
                    'For workstreams: the launch ID assigned by the parent workflow. When set, artifacts are stored under agents/{agent_run_id}/workstreams/{launch_id}/ to consolidate all artifacts under the parent agent run.',
            })
            .optional(),
        app_version: z
            .string()
            .meta({
                description:
                    'The exact app version this run is pinned to, derived from the `@version` on the started interaction ref / the `x-vertesia-app-version` header at start. Persisted on the state so it survives resume, and applied to the activity client (`withAppVersion`) so every app-owned ref the run resolves — interactions, types, processes, tools — targets this version instead of the current/promoted one. Undefined → current/promoted. Resolution-time only; never a stored capability-ref version.',
            })
            .optional(),
    })
    .meta({
        id: 'ConversationState',
        description:
            'Conversation state passed between workflow activities: the activity-safe, per-turn dynamic subset of a multi-turn agent conversation. Rides every conversation activity payload, so it deliberately excludes anything large or fetchable — the conversation history and tool definitions live in artifact storage (referenced via `tool_reference` / the conversation storage id), and catalog/activation data lives in the workflow-memory  {@link  ConversationCatalogState }  (persisted as catalog.json).',
    });

export const UpdateExecutionRunPayloadSchema = z
    .strictObject({
        id: z.string().optional(),
        parent: z
            .union([z.string(), ExecutionRunSchema])
            .meta({
                description:
                    'Only used by runs that were created by a virtual run to point toward the virtual run parent',
            })
            .optional(),
        evaluation: z
            .strictObject({
                score: z.number().optional(),
                selected: z.boolean().optional(),
                scores: NumberValueMapSchema.optional(),
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        environment: ExecutionEnvironmentRefSchema.meta({
            description: 'Environment reference - populated with full object in API responses',
        }).optional(),
        modelId: z.string().optional(),
        result_schema: JSONSchemaSchema.optional(),
        ttl: z.number().optional(),
        status: ExecutionRunStatusSchema.optional(),
        finish_reason: z.string().optional(),
        prompt: z.unknown().optional(),
        token_use: ExecutionTokenUsageSchema.optional(),
        prompt_cache_diagnostics: z.array(PromptCacheDiagnosticSchema).optional(),
        chunks: z.number().optional(),
        execution_time: z.number().optional(),
        created_at: z.string().meta({ format: 'date-time' }).optional(),
        updated_at: z.string().meta({ format: 'date-time' }).optional(),
        account: AccountRefSchema.optional(),
        project: ProjectRefSchema.optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        error: InteractionExecutionErrorSchema.optional(),
        source: RunSourceSchema.optional(),
        output_modality: ModalitiesSchema.meta({
            description: 'Deprecated: This is deprecated. Use CompletionResult.type information instead.',
            deprecated: true,
            'x-deprecated-message': 'This is deprecated. Use CompletionResult.type information instead.',
        }).optional(),
        created_by: z.string().optional(),
        updated_by: z.string().optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description:
                'The Vertesia Workflow related to this Interaction Run.\n\nThis is only set when the interaction is executed as part of a workflow.',
        }).optional(),
        interaction: InteractionRefSchema.optional(),
    })
    .meta({ id: 'UpdateExecutionRunPayload' });

export const ExecutionRunRefArraySchema = z.array(ExecutionRunRefSchema).meta({ id: 'ExecutionRunRefArray' });

export const AsyncCompletionOptionsSchema = z
    .strictObject({
        run_id: z.string().meta({ description: 'Workflow run ID for message context' }),
        stream: z.boolean().meta({ description: 'Whether to stream chunks to Redis' }).optional(),
        streaming: StreamingOptionsSchema.meta({
            description: 'Streaming-specific options (required if stream=true)',
        }).optional(),
        task_token: z
            .string()
            .meta({
                description:
                    'Temporal task token for async activity completion (base64url encoded). When provided, the platform completes the activity after execution finishes, allowing the worker to release the activity slot immediately.',
            })
            .optional(),
        activity_id: z
            .string()
            .meta({
                description:
                    'Activity ID for idempotency metadata when storing conversation. Required when task_token is provided.',
            })
            .optional(),
        current_state: ConversationStateSchema.meta({
            description:
                'Current conversation state to merge with execution result. The platform stores the conversation and completes the activity with merged state. Required when task_token is provided.',
        }).optional(),
        heartbeat_interval_ms: z
            .number()
            .meta({
                description:
                    'Interval in milliseconds for sending heartbeats to Temporal during streaming. When provided, the platform sends periodic heartbeats to keep the activity alive. Recommended: 10000 (10 seconds). Activity heartbeat timeout should be ~3x this value.',
            })
            .optional(),
        telemetry: StreamingTelemetryContextSchema.meta({
            description:
                'Telemetry context for sending LlmCallEvent after streaming completes. The platform uses this to send token usage telemetry since the activity exits before the response is available in async completion mode.',
        }).optional(),
        result_storage: ResultStorageOptionsSchema.meta({
            description:
                'Storage options for inference result. When provided, the platform stores the result at the specified path after inference completes (before completing the Temporal activity).',
        }).optional(),
        completion_mode: AsyncCompletionModeSchema.meta({
            description:
                "Controls the value used to complete the Temporal activity. Defaults to `conversation_state` for agent resume/continuation calls. Use `text` for one-shot helper calls, such as checkpoint summaries, that need the model's text result instead of merged conversation state.",
        }).optional(),
    })
    .meta({ id: 'AsyncCompletionOptions', description: 'Options for async completion and/or streaming LLM responses' });

export const NamedInteractionExecutionPayloadSchema = z
    .strictObject({
        data: z
            .unknown()
            .meta({
                description:
                    'If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location. and the other properties of the data will contain the memory pack mapping.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        stream: z.boolean().optional(),
        do_validate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        conversation: z
            .unknown()
            .meta({
                description:
                    'The conversation state to be used in the execution if any. If the `true` is passed then the conversation will be returned in the result. The true value must be used for the first execution that starts the conversation. If conversation is falsy then no conversation is returned back. For regular executions the conversation is not returned back to save memory.',
            })
            .optional(),
        tool_definitions: z
            .array(ToolDefinitionSchema)
            .meta({ description: 'The tools to be used in the execution' })
            .optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description: 'The workflow related to this Interaction Run.',
        }).optional(),
        prompts: z
            .array(InCodePromptSchema)
            .meta({
                description:
                    'Only used by ad-hoc interactions which defines the prompt in the execution payload itself These are temporary interactions using "tmp:" suffix.',
            })
            .optional(),
        asyncCompletion: AsyncCompletionOptionsSchema.meta({
            description:
                'Options for async completion and/or streaming LLM response chunks to Redis. Used by agent workflows for async activity completion and real-time streaming.',
        }).optional(),
        interaction: z.string().meta({
            description:
                'The interaction name and suffixed by an optional tag or version separated from the name using a @ character If no version/tag part is specified then the latest version is used. Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag',
        }),
    })
    .meta({ id: 'NamedInteractionExecutionPayload' });

export const InteractionExecutionPayloadSchema = z
    .strictObject({
        data: z
            .unknown()
            .meta({
                description:
                    'If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location. and the other properties of the data will contain the memory pack mapping.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        stream: z.boolean().optional(),
        do_validate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        conversation: z
            .unknown()
            .meta({
                description:
                    'The conversation state to be used in the execution if any. If the `true` is passed then the conversation will be returned in the result. The true value must be used for the first execution that starts the conversation. If conversation is falsy then no conversation is returned back. For regular executions the conversation is not returned back to save memory.',
            })
            .optional(),
        tool_definitions: z
            .array(ToolDefinitionSchema)
            .meta({ description: 'The tools to be used in the execution' })
            .optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description: 'The workflow related to this Interaction Run.',
        }).optional(),
        prompts: z
            .array(InCodePromptSchema)
            .meta({
                description:
                    'Only used by ad-hoc interactions which defines the prompt in the execution payload itself These are temporary interactions using "tmp:" suffix.',
            })
            .optional(),
        asyncCompletion: AsyncCompletionOptionsSchema.meta({
            description:
                'Options for async completion and/or streaming LLM response chunks to Redis. Used by agent workflows for async activity completion and real-time streaming.',
        }).optional(),
    })
    .meta({ id: 'InteractionExecutionPayload' });

export const AsyncInteractionExecutionPayloadSchema = z
    .object({
        interaction: z.string().meta({
            description:
                'The interaction name and suffixed by an optional tag or version separated from the name using a @ character If no version/tag part is specified then the latest version is used. Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag',
        }),
        data: z
            .unknown()
            .meta({
                description:
                    'If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location. and the other properties of the data will contain the memory pack mapping.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        do_validate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        conversation: z
            .unknown()
            .meta({
                description:
                    'The conversation state to be used in the execution if any. If the `true` is passed then the conversation will be returned in the result. The true value must be used for the first execution that starts the conversation. If conversation is falsy then no conversation is returned back. For regular executions the conversation is not returned back to save memory.',
            })
            .optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description: 'The workflow related to this Interaction Run.',
        }).optional(),
        prompts: z
            .array(InCodePromptSchema)
            .meta({
                description:
                    'Only used by ad-hoc interactions which defines the prompt in the execution payload itself These are temporary interactions using "tmp:" suffix.',
            })
            .optional(),
        asyncCompletion: AsyncCompletionOptionsSchema.meta({
            description:
                'Options for async completion and/or streaming LLM response chunks to Redis. Used by agent workflows for async activity completion and real-time streaming.',
        }).optional(),
        type: z.literal('interaction'),
        notify_endpoints: z
            .array(z.string())
            .meta({ description: 'An array of endpoint URLs to be notified upon execution' })
            .optional(),
        task_queue: z.string().optional(),
        include_previous_error: z
            .boolean()
            .meta({
                description:
                    'Only used for non conversation workflows to include the error on next retry. If tools is defined this is not used',
            })
            .optional(),
    })
    .meta({ id: 'AsyncInteractionExecutionPayload' });

export const ConversationEnrichmentFields = {
    title: z.string().min(1).meta({ description: 'Caller-provided conversation title.' }).optional(),
    topic: z
        .string()
        .min(1)
        .meta({ description: 'Caller-provided conversation topic. Suppresses automatic topic generation.' })
        .optional(),
    generate_topic: z
        .boolean()
        .meta({
            description:
                'Whether to generate a conversation title and topic automatically. Defaults to true; a caller-provided topic always suppresses generation.',
        })
        .optional(),
    generate_lessons: z
        .boolean()
        .meta({
            description:
                'Whether to generate lessons automatically at completion. Defaults to true; conversation content remains searchable when disabled.',
        })
        .optional(),
};

export const AsyncConversationExecutionPayloadSchema = z
    .object({
        interaction: z.string().meta({
            description:
                'The interaction name and suffixed by an optional tag or version separated from the name using a @ character If no version/tag part is specified then the latest version is used. Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag',
        }),
        ...ConversationEnrichmentFields,
        app_version: z
            .string()
            .meta({
                description:
                    'Immutable app-version target inherited by this conversation execution. The workflow applies it to app-owned resource resolution; callers normally set the x-vertesia-app-version header instead of populating this field directly.',
            })
            .optional(),
        data: z
            .unknown()
            .meta({
                description:
                    'If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location. and the other properties of the data will contain the memory pack mapping.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        do_validate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        conversation: z
            .unknown()
            .meta({
                description:
                    'The conversation state to be used in the execution if any. If the `true` is passed then the conversation will be returned in the result. The true value must be used for the first execution that starts the conversation. If conversation is falsy then no conversation is returned back. For regular executions the conversation is not returned back to save memory.',
            })
            .optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description: 'The workflow related to this Interaction Run.',
        }).optional(),
        prompts: z
            .array(InCodePromptSchema)
            .meta({
                description:
                    'Only used by ad-hoc interactions which defines the prompt in the execution payload itself These are temporary interactions using "tmp:" suffix.',
            })
            .optional(),
        asyncCompletion: AsyncCompletionOptionsSchema.meta({
            description:
                'Options for async completion and/or streaming LLM response chunks to Redis. Used by agent workflows for async activity completion and real-time streaming.',
        }).optional(),
        type: z.literal('conversation'),
        notify_endpoints: z
            .array(z.string())
            .meta({ description: 'An array of endpoint URLs to be notified upon execution' })
            .optional(),
        task_queue: z.string().optional(),
        tool_approval_mode: AgentToolApprovalModeSchema.meta({
            description: 'Effective tool approval mode for interactive agent conversations.',
        }).optional(),
        visibility: ConversationVisibilitySchema.meta({
            description:
                'Visibility determine if the conversation should be seen by the user only or by anyone with access to the project If not specified, the default is project',
        }).optional(),
        tool_names: z
            .array(z.string())
            .meta({
                description:
                    'The tools to use, list of tool or function names. You can use + and - to add or remove from default, if no sign, then list replaces default',
            })
            .optional(),
        initial_skills: z
            .array(z.string())
            .meta({
                description:
                    'Builtin system skills to activate at conversation start. Their related tools are exposed from the first turn and their instructions are injected into the initial context, replacing the learn_<skill> round-trip.',
            })
            .optional(),
        initial_tool_calls: z
            .array(InitialToolCallSchema)
            .meta({
                description:
                    "Tool calls executed before the first model turn. Results are injected into the initial context. These run sequentially with the caller's authority before the first model turn. Only a bounded set of read/hydration tools is accepted.",
            })
            .optional(),
        excluded_tools: z
            .array(z.string())
            .meta({
                description:
                    'Hard denylist of tool names for this conversation. Excluded tools are never exposed to the model and are refused at execution time, even when a skill or tool refresh would otherwise unlock them. Takes precedence over tool_names, initial_skills, and skill-based tool activation.',
            })
            .optional(),
        max_iterations: z
            .number()
            .meta({
                description:
                    'The maximum number of iterations in case of a conversation. If <=0 the default of 20 will be used.',
            })
            .optional(),
        interactive: z
            .boolean()
            .meta({ description: 'Whether the conversation should be interactive or not' })
            .optional(),
        user_channels: z
            .array(UserChannelSchema)
            .meta({
                description:
                    'Array of channels to use for user communication. Multiple channels can be active simultaneously (e.g., both email and interactive). Each channel contains its own configuration and state (e.g., email threading info).',
            })
            .optional(),
        disable_interaction_tools: z
            .boolean()
            .meta({ description: 'Whether to disable the generation of interaction tools or not.' })
            .optional(),
        search_scope: AgentSearchScope_CollectionSchema.meta({
            description:
                'On which scope should the searched by applied, by the search_tool. Only supports collection scope or null for now.',
        }).optional(),
        collection_id: z
            .string()
            .meta({ description: 'The collection in which this workflow is executing' })
            .optional(),
        disabled_mcp_collections: z
            .array(z.string())
            .meta({
                description:
                    'Denylist of MCP tool-collection ids deactivated for this conversation. `undefined`/empty means all installed/connected MCP collections are active (back-compat, and new servers stay active by default). Listed collections are excluded even if connected. Can be updated mid-conversation via the MCP config signal.',
            })
            .optional(),
        checkpoint_tokens: z
            .number()
            .meta({
                description:
                    'The token threshold in thousands (K) for creating checkpoints. If total tokens exceed this value, a checkpoint will be created. When set it wins over every other checkpoint setting, including the structured `checkpoint` override below. If not specified, the default is computed from the selected model context window (80%, capped at 500k).',
            })
            .optional(),
        checkpoint: AgentCheckpointConfigurationSchema.meta({
            description:
                "Structured per-run checkpoint override. Field-wise it takes precedence over the interaction's `agent_runner_options.checkpoint` and the project's `configuration.agent.checkpoint`. The legacy absolute `checkpoint_tokens` above still wins over everything when set.",
        }).optional(),
        strip_options: ConversationStripOptionsSchema.meta({
            description:
                'Configuration for stripping large data (images, text) from conversation history to prevent JSON serialization issues and reduce storage bloat.',
        }).optional(),
        task_id: z.string().meta({ description: 'In child execution workflow, this is the curent task_id' }).optional(),
        launch_id: z
            .string()
            .meta({
                description:
                    'Parent-assigned launch ID for non-blocking workstreams. The child uses this when signaling progress/completion back to the parent.',
            })
            .optional(),
        debug_mode: z.boolean().meta({ description: 'Whether to enable debug mode' }).optional(),
        max_nested_conversation_depth: z
            .number()
            .meta({ description: 'Maximum depth for nested conversations to prevent infinite recursion (default: 5)' })
            .optional(),
        parent_metadata: z
            .looseObject({})
            .meta({
                description:
                    "Metadata inherited from parent workflow. Used to propagate context (e.g., apiKey, session info) to child workflows/workstreams. When a workstream is spawned, the parent's `data` is preserved here so that child tools can access it via metadata.parent_metadata.",
            })
            .optional(),
        non_blocking_subagents: z
            .boolean()
            .meta({
                description:
                    'When true, subagent/workstream tool calls use fire-and-forget `startChild()` instead of blocking `executeChild()`. The parent continues reasoning while children run, receiving progress/completion via Temporal signals.',
            })
            .optional(),
        restart_from_workflow_run_id: z
            .string()
            .meta({
                description:
                    "Temporal runId of a previous workflow to restart/fork from. When set, conversation history is loaded from the old run's GCS storage instead of calling startConversation fresh.",
            })
            .optional(),
        source_first_workflow_run_id: z
            .string()
            .meta({
                description:
                    'The Temporal firstExecutionRunId of the original workflow being restarted/forked. Used by loadConversationForRestart to look up the original ExecutionRun so that token accumulation and status updates target a valid run.',
            })
            .optional(),
        is_fork: z
            .boolean()
            .meta({
                description:
                    'When true, indicates this is a fork (new ExecutionRun) rather than a restart (reuse original).',
            })
            .optional(),
        agent_run_id: z
            .string()
            .meta({
                description:
                    'The AgentRun MongoDB _id. Used for artifact storage paths: agents/{agent_run_id}/ Flows into ConversationState and down to workstreams. Undefined for legacy workflows started before the AgentRun system.',
            })
            .optional(),
        schedule_id: z
            .string()
            .meta({
                description:
                    'The Schedule MongoDB _id. Set when this execution was triggered by a Temporal schedule. Used by the workflow to create an AgentRun on first run if agent_run_id is absent.',
            })
            .optional(),
    })
    .meta({ id: 'AsyncConversationExecutionPayload' });

export const RunCreatePayloadSchema = z
    .strictObject({
        data: z
            .unknown()
            .meta({
                description:
                    'If a `@memory` property exists on the input data then the value will be used as the value of a memory pack location. and the other properties of the data will contain the memory pack mapping.',
            })
            .optional(),
        config: InteractionExecutionConfigurationSchema.optional(),
        result_schema: z.union([JSONSchemaSchema, SchemaRefSchema, z.null()]).optional(),
        stream: z.boolean().optional(),
        do_validate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        conversation: z
            .unknown()
            .meta({
                description:
                    'The conversation state to be used in the execution if any. If the `true` is passed then the conversation will be returned in the result. The true value must be used for the first execution that starts the conversation. If conversation is falsy then no conversation is returned back. For regular executions the conversation is not returned back to save memory.',
            })
            .optional(),
        tool_definitions: z
            .array(ToolDefinitionSchema)
            .meta({ description: 'The tools to be used in the execution' })
            .optional(),
        workflow: ExecutionRunWorkflowSchema.meta({
            description: 'The workflow related to this Interaction Run.',
        }).optional(),
        prompts: z
            .array(InCodePromptSchema)
            .meta({
                description:
                    'Only used by ad-hoc interactions which defines the prompt in the execution payload itself These are temporary interactions using "tmp:" suffix.',
            })
            .optional(),
        asyncCompletion: AsyncCompletionOptionsSchema.meta({
            description:
                'Options for async completion and/or streaming LLM response chunks to Redis. Used by agent workflows for async activity completion and real-time streaming.',
        }).optional(),
        interaction: z.string().meta({
            description:
                'The interaction name and suffixed by an optional tag or version separated from the name using a @ character If no version/tag part is specified then the latest version is used. Example: ReviewContract, ReviewContract@draft, ReviewContract@1, ReviewContract@some-tag',
        }),
    })
    .meta({
        id: 'RunCreatePayload',
        description:
            'Interaction execution payload for creating a new run It uses interaction field (from NamedInteractionExecutionPayload) to pass the interaction ID to run',
    });

export const AsyncExecutionPayloadSchema = z
    .discriminatedUnion('type', [AsyncConversationExecutionPayloadSchema, AsyncInteractionExecutionPayloadSchema])
    .meta({ id: 'AsyncExecutionPayload' });

/** Query, header, and computed-facet contracts that are authored directly from their wire shapes. */

export const CatalogTagQuerySchema = z
    .strictObject({
        tag: z.string().optional(),
    })
    .meta({ id: 'CatalogTagQuery' });

export const StoredCatalogInteractionsQuerySchema = z
    .strictObject({
        tag: z.string().optional(),
        status: z.string().optional(),
        published: z.boolean().optional(),
    })
    .meta({ id: 'StoredCatalogInteractionsQuery' });

export const ExecuteInteractionByEndpointQuerySchema = z
    .strictObject({
        tag: z.string().optional(),
    })
    .meta({ id: 'ExecuteInteractionByEndpointQuery' });

export const ExecuteInteractionByEndpointHeadersSchema = z
    .strictObject({
        'x-interaction-tag': z.string().optional(),
    })
    .meta({ id: 'ExecuteInteractionByEndpointHeaders' });

export const ResolveInteractionQuerySchema = z
    .strictObject({
        environment: z.string().optional(),
        model: z.string().optional(),
        hasImage: z.boolean().optional(),
        hasVideo: z.boolean().optional(),
    })
    .meta({ id: 'ResolveInteractionQuery' });

// `z.unknown().meta({ type: [...] })` rather than `z.union([z.array(...), z.number()])`, which is
// the shape the TypeScript index signature actually describes. Two reasons, and they agree:
// the published component is `{ type: ['array', 'number'] }`, so this re-emits it unchanged; and
// a union here would publish `anyOf` on an additionalProperties value, which the generated-client
// rules rule out for a primitive-or-collection value. The emitted schema is what AJV compiles, so
// array-or-number is enforced either way.
// `total` is RESERVED: it is the match count and nothing else. The buckets live beside it under the
// facet's own name, so the two never need the same slot. `computeFacets` used to seed the count and
// then write the requested facets over it, so a caller who named a facet `total` got that facet's
// buckets where the count belonged — an array in a field this schema types as a number. The server
// now rejects that name with a 400 instead, which is why `total` can stay a plain number here.
//
// Widening it to the catchall's `['array', 'number']` is not an option regardless: a NAMED property
// with a type array makes the Java generator reference a class it never writes (`AnyOfnumber`) and
// the client stops compiling. The catchall gets away with it by becoming a map value, not a field.
export const ComputedFacetResponseSchema = z
    .object({
        total: z.number().optional(),
    })
    .catchall(z.unknown().meta({ type: ['array', 'number'] }))
    .meta({ id: 'ComputedFacetResponse' });

const resumeConversationFields = {
    run: ExecutionRunDocRefSchema,
    environment: z.string(),
    options: StatelessExecutionOptionsSchema,
    // Optional because `unknown` includes `undefined` in TypeScript and `JSON.stringify` drops an
    // undefined value entirely, so a caller resuming without prior conversation state sends no
    // `conversation` key at all. `z.unknown()` alone still lists it in `required`, which rejected
    // exactly those callers — the first message of a conversation.
    conversation: z.unknown().optional(),
    tools: z.array(ToolDefinitionSchema),
    strip_options: ConversationStripOptionsSchema.optional(),
    asyncCompletion: AsyncCompletionOptionsSchema.optional(),
};

export const ToolResultsPayloadSchema = z
    .strictObject({ ...resumeConversationFields, results: z.array(ToolResultSchema) })
    .meta({ id: 'ToolResultsPayload' });

export const UserMessagePayloadSchema = z
    .strictObject({
        ...resumeConversationFields,
        message: z.string(),
        /**
         * Tool results still owed to the model when the user message is sent.
         *
         * A conversation can be interrupted — the user stops the run, or a tool approval is
         * denied — while a tool batch has already produced results, or while `tool_use` blocks
         * are outstanding. Providers require a `tool_result` for every `tool_use` before the
         * next turn, so those results have to travel with the message that resumes the
         * conversation rather than in a separate turn of their own.
         */
        results: z
            .array(ToolResultSchema)
            .optional()
            .meta({ description: 'Tool results owed to the model, delivered with this message.' }),
    })
    .meta({ id: 'UserMessagePayload' });

export const ExecutionResponseSchema = z
    .strictObject({
        result: z.array(CompletionResultSchema),
        token_usage: ExecutionTokenUsageSchema.optional(),
        prompt_cache_diagnostic: PromptCacheDiagnosticSchema.optional(),
        service_tier: z.string().meta({ description: 'Processing tier actually used by the provider' }).optional(),
        tool_use: z.array(ToolUseSchema).optional(),
        finish_reason: z.string().optional(),
        error: z
            .strictObject({
                code: z.enum(['validation_error', 'json_error', 'content_policy_violation']),
                message: z.string(),
                data: z.array(CompletionResultSchema).optional(),
            })
            .optional(),
        original_response: z.unknown().optional(),
        conversation: z.unknown().optional(),
        prompt: z.unknown(),
        execution_time: z.number().optional(),
        chunks: z.number().optional(),
    })
    .meta({ id: 'ExecutionResponse' });

const RunFacetSpecSchema = z.discriminatedUnion('name', [
    z.strictObject({ name: z.literal('environments'), field: z.literal('environment') }),
    z.strictObject({ name: z.literal('interactions'), field: z.literal('interaction') }),
    z.strictObject({ name: z.literal('models'), field: z.literal('modelId') }),
    z.strictObject({ name: z.literal('statuses'), field: z.literal('status') }),
    z.strictObject({ name: z.literal('finish_reason'), field: z.literal('finish_reason') }),
]);

export const ComputeRunFacetPayloadSchema = z
    .strictObject({ facets: z.array(RunFacetSpecSchema).max(5), query: RunSearchQuerySchema.optional() })
    .meta({ id: 'ComputeRunFacetPayload' });

export const RunSearchMetaResponseSchema = z
    .strictObject({
        count: z.strictObject({ lower_bound: z.number().optional(), total: z.number().optional() }),
        facet: z.record(
            z.string(),
            z.strictObject({
                buckets: z.array(z.strictObject({ _id: z.string(), count: z.number() })),
            }),
        ),
    })
    .meta({ id: 'RunSearchMetaResponse' });

const RunFacetBucketSchema = z.strictObject({
    _id: z.string().nullable(),
    count: z.number(),
    name: z.string().optional(),
    status: InteractionStatusSchema.optional(),
    version: z.number().optional(),
});

/**
 * Response returned by POST /runs/facets.
 */
export const ComputeRunFacetsResponseSchema = z
    .strictObject({
        environments: z.array(RunFacetBucketSchema).optional(),
        interactions: z.array(RunFacetBucketSchema).optional(),
        models: z.array(RunFacetBucketSchema).optional(),
        statuses: z.array(RunFacetBucketSchema).optional(),
        finish_reason: z.array(RunFacetBucketSchema).optional(),
        total: z.number().optional(),
    })
    .meta({ id: 'ComputeRunFacetsResponse' });

export const RunClonePayloadSchema = z
    .strictObject({
        source_run_id: z.string(),
        workflow: z.strictObject({ run_id: z.string(), workflow_id: z.string() }),
    })
    .meta({ id: 'RunClonePayload' });
