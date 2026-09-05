import { z } from 'zod';
import { APPGEN_PACKAGE_SPEC_PATTERN } from '../appgen.js';
import { AppAccessControlSchema, AppAvailableInSchema, MCPToolAnnotationsSchema } from './apps.js';
import { EventCategorySchema } from './audit-trail.js';

// The app lifecycle contracts: versions, builds, scaffolds, git repositories, development tasks,
// installations and inspection. `./apps.js` holds the manifest itself and the tool-collection
// leaves it reaches; this holds everything an app *does* after it exists.
//
// `AppManifest` and `AppManifestData` are still derived, and so is every slot that embeds one
// (`CreateApp`, `ListApps`, `PromoteAppVersion`, and the installation reads that return
// `AppInstallationWithManifest`). The blocker is stated at the bottom of `./apps.js`: the manifest's
// `settings_schema` is a `JSONSchema`, and studio's derived spelling of that component disagrees with
// the canonical one. `AppInstallation` itself carries no manifest, so the install and settings slots
// convert here.
//
// The `AgentRunSearchHit` sub-tree is not app-specific: it arrives through
// `AppDevelopmentTaskDetails.agent_run`, which reports the assistant run that produced a task branch.
// It is declared here because this is the first slot to publish it, and the agent-run endpoints will
// reference these same components when they convert rather than restating them.
//
// Line comments rather than JSDoc blocks throughout: a JSDoc block immediately preceding an exported
// declaration is picked up by the OpenAPI scanner and published as that component's `description`,
// which would double up with the `description` stated in `.meta()`.
//
// Descriptions are reproduced verbatim from the published document, `{@link  X }` spacing artifacts
// included, so the spec diff stays legible. Rewording is a separate, deliberate contract change.

// `.nullable()` would emit `anyOf: [{type: array}, {type: null}]`; the published component is
// `type: ['array', 'null']`, and the name is still derived from TypeScript wherever a slot has not
// converted, so the two spellings have to agree byte for byte. Annotated rather than inferred for the
// same reason `cost-analytics.ts` annotates its time boundaries.
const nullableToolAllowlistSchema: z.ZodType<string[] | null> = z
    .any()
    .meta({ type: ['array', 'null'], items: { type: 'string' } });

export const UpdateAppInstallationToolAllowlistPayloadSchema = z
    .strictObject({
        tool_allowlist: nullableToolAllowlistSchema,
    })
    .meta({ id: 'UpdateAppInstallationToolAllowlistPayload' });

export const ValidateUrlResponseSchema = z
    .strictObject({
        valid: z.boolean(),
    })
    .meta({ id: 'ValidateUrlResponse' });

export const ValidateUrlRequestSchema = z
    .strictObject({
        url: z.string(),
    })
    .meta({ id: 'ValidateUrlRequest' });

export const AppVersionUrlsSchema = z
    .strictObject({
        live_url: z.string().optional(),
        app_url: z.string().optional(),
        plugin_url: z.string().optional(),
        package_url: z.string().optional(),
        internal_preview_url: z.string().optional(),
    })
    .meta({ id: 'AppVersionUrls' });

export const AppVersionGitRefTypeSchema = z
    .enum(['branch', 'tag', 'commit', 'detached'])
    .meta({ id: 'AppVersionGitRefType' });

export const AppVersionTargetSchema = z.enum(['static', 'service']).meta({ id: 'AppVersionTarget' });

export const AppVersionStateSchema = z.enum(['ready', 'failed', 'expired']).meta({ id: 'AppVersionState' });

export const AppVersionKindSchema = z.enum(['design', 'version']).meta({ id: 'AppVersionKind' });

export const StartAppScaffoldResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        app_id: z.string(),
        app_record_id: z.string().optional(),
        git_url: z.string().optional(),
        create_version: z.boolean(),
    })
    .meta({ id: 'StartAppScaffoldResponse' });

export const AppScaffoldModuleSchema = z
    .enum(['service', 'assistant', 'content-app', 'examples'])
    .meta({ id: 'AppScaffoldModule' });

export const AppBuildTriggerSchema = z.enum(['ui', 'git_push', 'agent', 'api']).meta({ id: 'AppBuildTrigger' });

export const Extract_AppVersionGitRefType_branch_tag_commitSchema = z
    .enum(['branch', 'tag', 'commit'])
    .meta({ id: 'Extract_AppVersionGitRefType_branch_tag_commit' });

export const StartAppBuildResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        app_id: z.string(),
        version_id: z.string().optional(),
        rebuild_version_record_id: z.string().optional(),
        source_ref: z.string().optional(),
        source_ref_type: Extract_AppVersionGitRefType_branch_tag_commitSchema.optional(),
    })
    .meta({ id: 'StartAppBuildResponse' });

export const AgentToolApprovalClassSchema = z
    .enum(['read_only', 'side_effecting', 'control', 'requires_confirmation'])
    .meta({
        id: 'AgentToolApprovalClass',
        description:
            'Approval behavior class for a tool exposed to agents.\n\n- `read_only`: reads or inspects state without changing Vertesia, external systems, or user-visible artifacts.\n- `side_effecting`: can create, update, delete, send, execute, schedule, or otherwise change state.\n- `control`: affects agent control flow or tool availability, not user data or external systems.\n- `requires_confirmation`: high-impact action that must ask the user even in interactive full-control mode.',
    });

export const AppDevelopmentTaskSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Task slug derived from the branch name.' }),
        branch: z.string().meta({ description: 'Complete Git branch name.' }),
        source_commit: z.string().meta({ description: 'Commit currently at the branch head.' }),
        commit_date: z.string().meta({ description: 'Branch-head commit date, when available.' }).optional(),
    })
    .meta({
        id: 'AppDevelopmentTask',
        description: 'A mutable app development task represented by an `agent/*` Git branch.',
    });

export const AppInstallationProviderBindingSchema = z
    .strictObject({
        provider_key: z.string().meta({ description: 'Key from AppManifestData.oauth_providers' }),
        oauth_provider_id: z.string().meta({ description: 'MongoDB ObjectId of the created OAuth provider' }),
        oauth_provider_name: z
            .string()
            .meta({ description: 'Name of the OAuth provider at creation time (for audit/display only)' }),
    })
    .meta({
        id: 'AppInstallationProviderBinding',
        description:
            'Binding between a named OAuth provider and the OAuth provider created for it at install time. Stored on AppInstallation so the runtime can resolve the correct OAuth provider for collections that reference a shared provider via MCPToolCollectionObject.oauth_provider.',
    });

export const AppInstallationOAuthBindingSchema = z
    .strictObject({
        collection_id: z.string().meta({
            description:
                'Stable collection identifier: MCPToolCollectionObject.id for new manifests. Legacy installations may still contain a name-based fallback value.',
        }),
        oauth_provider_id: z.string().meta({
            description:
                'MongoDB ObjectId of the OAuth provider in this project. Used for ID-based lookups (rename-proof).',
        }),
        oauth_provider_name: z.string().meta({
            description:
                'Name of the OAuth provider at creation time. Used by the workflow token path (getMCPClient → remoteMcpConnections.getToken) which looks up by name.',
        }),
    })
    .meta({
        id: 'AppInstallationOAuthBinding',
        description:
            'Binding between an MCP collection and an OAuth provider created at install time. Stored on AppInstallation so the runtime can look up the correct OAuth provider by ID, independent of manifest oauth_provider references (which may change).',
    });

export const OAuthClientCredentialsSchema = z
    .strictObject({
        client_id: z.string().optional(),
        client_secret: z.string().optional(),
        scopes: z.array(z.string()).optional(),
    })
    .meta({ id: 'OAuthClientCredentials' });

export const AppPackageScopeSchema = z
    .enum([
        'ui',
        'tools',
        'interactions',
        'types',
        'processes',
        'views',
        'templates',
        'dashboards',
        'settings',
        'widgets',
        'activities',
        'hooks',
        'subscriptions',
        'all',
    ])
    .meta({ id: 'AppPackageScope' });

export const AppInspectionCapabilityReportSchema = z
    .strictObject({
        capability: AppPackageScopeSchema,
        declared: z
            .boolean()
            .meta({ description: "True when the manifest's `capabilities` array declares this capability." }),
        exposed_ids: z
            .array(z.string())
            .meta({ description: 'The local ids the promoted package actually serves for this capability.' }),
        exposed_count: z.number().meta({ description: 'Convenience count of `exposed_ids`.' }),
    })
    .meta({
        id: 'AppInspectionCapabilityReport',
        description:
            "Per-capability report of what an app's promoted package actually exposes, compared against what its manifest declares.",
    });

export const AppScaffoldProgressStatusSchema = z
    .enum(['queued', 'reserving', 'scaffolding', 'pushing', 'building', 'completed', 'failed'])
    .meta({ id: 'AppScaffoldProgressStatus' });

export const AppRepoTreeEntrySchema = z
    .strictObject({
        name: z.string().meta({ description: 'File or directory name (last path segment).' }),
        path: z.string().meta({ description: 'Path relative to the repo root.' }),
        type: z
            .enum(['blob', 'tree'])
            .meta({ description: 'Whether the entry is a file (`blob`) or a directory (`tree`).' }),
    })
    .meta({
        id: 'AppRepoTreeEntry',
        description: 'One entry in an app git-repo directory listing (see  {@link  AppRepoTree } ).',
    });

export const AppRepoRefSchema = z
    .strictObject({
        name: z.string().meta({ description: 'Short ref name (e.g. `main`, `v1.0.0`).' }),
        commit: z
            .string()
            .meta({ description: 'Commit hash the ref points at (annotated tags are peeled to their commit).' }),
        commit_subject: z
            .string()
            .meta({ description: 'First line of the commit message, when available.' })
            .optional(),
        commit_date: z.string().meta({ description: 'Commit date as an ISO-8601 string, when available.' }).optional(),
        commit_author: z.string().meta({ description: 'Commit author name, when available.' }).optional(),
    })
    .meta({ id: 'AppRepoRef', description: 'A branch or tag in an app git repo, resolved to its latest commit.' });

export const AppRepoCommitSchema = z
    .strictObject({
        commit: z.string().meta({ description: 'Full commit SHA.' }),
        message: z.string().meta({ description: 'Complete commit message.' }),
        author: z.string().meta({ description: 'Commit author name, when available.' }).optional(),
        date: z.string().meta({ description: 'Commit author date as an ISO-8601 string, when available.' }).optional(),
    })
    .meta({ id: 'AppRepoCommit', description: 'One commit that inserted or changed a file in an app git repository.' });

export const AgentRunTypeSchema = z
    .enum(['api', 'schedule', 'event_subscription'])
    .meta({ id: 'AgentRunType', description: 'How the agent run was created.' });

export const EventRefSchema = z
    .strictObject({
        event_id: z.string(),
        root_event_id: z.string(),
        caused_by_event_id: z.string().optional(),
        hop_count: z.number(),
        event_category: EventCategorySchema,
        action: z.string(),
        resource_type: z.string(),
        resource_id: z.string(),
        account_id: z.string().nullable(),
        project_id: z.string().nullable(),
        tenant_id: z.string().nullable(),
    })
    .meta({ id: 'EventRef' });

export const InCodeTypeRefSchema = z
    .strictObject({
        ref_type: z.literal('incode'),
        id: z.string().meta({
            description: 'Namespaced identifier for in-code types (e.g. "sys:Invoice", "app:myapp:Contract")',
        }),
        name: z.string(),
        default_view: z
            .enum(['auto', 'text', 'pdf', 'image', 'properties'])
            .meta({
                description:
                    "Display hint from the type's intake policy (`intake.default_view`). Enriched by the API on single-object reads so clients can pick the initial view without fetching the type. Absent on list responses and older servers.",
            })
            .optional(),
    })
    .meta({ id: 'InCodeTypeRef' });

export const StoredTypeRefSchema = z
    .strictObject({
        ref_type: z.literal('stored'),
        id: z.string().meta({ description: 'MongoDB ObjectId string for stored types' }),
        name: z.string(),
        default_view: z
            .enum(['auto', 'text', 'pdf', 'image', 'properties'])
            .meta({
                description:
                    "Display hint from the type's intake policy (`intake.default_view`). Enriched by the API on single-object reads so clients can pick the initial view without fetching the type. Absent on list responses and older servers.",
            })
            .optional(),
    })
    .meta({ id: 'StoredTypeRef' });

export const ConversationActivityStateSchema = z.enum(['working', 'idle']).meta({ id: 'ConversationActivityState' });

export const AgentRunStatusSchema = z
    .enum(['created', 'running', 'completed', 'failed', 'cancelled'])
    .meta({ id: 'AgentRunStatus', description: 'Status of an agent run through its lifecycle.' });

export const RunKindSchema = z.enum(['agent', 'process']).meta({
    id: 'RunKind',
    description: 'Internal discriminator key for documents stored in the agent_runs collection.',
});

export const RunTypeSchema = z
    .enum(['autonomous', 'supervised', 'programmatic'])
    .meta({ id: 'RunType', description: 'Public-facing runtime mode.' });

export const AppBuildProgressStatusSchema = z
    .enum(['queued', 'resolving', 'building', 'completed', 'failed'])
    .meta({ id: 'AppBuildProgressStatus' });

export const DeleteAppVersionResponseSchema = z
    .strictObject({
        id: z.string(),
        app_id: z.string(),
        version_id: z.string(),
        storage_prefix: z.string().optional(),
        deleted: z.boolean(),
        warnings: z.array(z.string()),
    })
    .meta({ id: 'DeleteAppVersionResponse' });

export const AppDeleteSummarySchema = z
    .strictObject({
        confirmed: z.boolean().meta({
            description:
                'Whether `?confirm=true` was sent. Without it the endpoint reports what WOULD be removed and ' +
                'deletes nothing — `deleted` stays false.',
        }),
        app_id: z.string(),
        app_name: z.string(),
        versions: z.number().meta({ description: 'AppVersion records the cascade covers.' }),
        installations: z.number().meta({ description: 'AppInstallation records the cascade covers.' }),
        storage_prefix: z.string(),
        git_repo_url: z.string().optional(),
        deleted: z.boolean().meta({
            description: 'Whether the app record itself was removed. False for a dry run.',
        }),
        warnings: z.array(z.string()).meta({
            description:
                'Cascade steps that failed without aborting the deletion. Credential cleanup is NOT among them — ' +
                'a failed API key purge fails the request outright and keeps the app row.',
        }),
    })
    .meta({
        id: 'AppDeleteSummary',
        description:
            'Result of `DELETE /apps/:id`. Doubles as the dry-run preview: without `?confirm=true` the same ' +
            'shape comes back with `deleted: false` describing what the cascade would remove.',
    });

export const AppRepoBranchSchema = z
    .strictObject({
        name: z.string(),
        commit: z.string(),
        source_ref: z.string(),
    })
    .meta({ id: 'AppRepoBranch', description: 'A newly created app repository branch.' });

export const AppRepoDocumentCommitSchema = z
    .strictObject({
        ref: z.string().meta({ description: 'Updated branch name.' }),
        previous_commit: z.string().meta({ description: 'Branch HEAD before the commit.' }),
        commit: z.string().meta({ description: 'Newly created commit SHA.' }),
        paths: z.array(z.string()).meta({ description: 'Repository paths changed by the commit.' }),
    })
    .meta({
        id: 'AppRepoDocumentCommit',
        description: 'Result of committing one or more uploaded documents to an app repository.',
    });

export const AppVersionGitSourceSchema = z
    .strictObject({
        url: z.string().optional(),
        remote: z.string().optional(),
        ref: z
            .string()
            .meta({
                description:
                    'The source ref that should be used to reproduce this version. Immutable app versions use the exact commit SHA rather than a mutable branch or tag.',
            })
            .optional(),
        ref_type: AppVersionGitRefTypeSchema.optional(),
        branch: z.string().optional(),
        tag: z.string().optional(),
        commit: z.string().optional(),
        dirty: z.boolean().optional(),
        pushed: z.boolean().optional(),
        push_warning: z.string().optional(),
    })
    .meta({ id: 'AppVersionGitSource' });

export const StartAppScaffoldRequestSchema = z
    .strictObject({
        app_id: z.string().meta({
            description: 'Package name for the new app to create and scaffold. This is not the id of an existing app.',
        }),
        title: z.string().optional(),
        description: z.string().optional(),
        modules: z.array(AppScaffoldModuleSchema).optional(),
        appgen_package_spec: z
            .string()
            .regex(APPGEN_PACKAGE_SPEC_PATTERN)
            .meta({
                description:
                    'Optional Vertesia SDK version or package track for this scaffold. Overrides the deployment default.',
            })
            .optional(),
        create_version: z
            .boolean()
            .meta({
                description: 'Start an initial app version build after the source has been pushed. Defaults to true.',
            })
            .optional(),
    })
    .meta({ id: 'StartAppScaffoldRequest' });

export const StartAppDevelopmentTaskRequestSchema = z
    .strictObject({
        prompt: z.string().min(1).meta({ description: 'Development request passed to the App Builder parent.' }),
        environment: z.string().min(1).meta({ description: 'Execution environment id for the App Builder run.' }),
        model: z.string().min(1).meta({ description: 'Model id for the App Builder run.' }),
        build_version: z
            .boolean()
            .meta({ description: 'Create one immutable app version after validation. Defaults to false.' })
            .optional(),
    })
    .meta({ id: 'StartAppDevelopmentTaskRequest' });

export const StartAppBuildRequestSchema = z
    .strictObject({
        source_ref: z
            .string()
            .meta({
                description:
                    'Source branch, tag, or commit to build. When omitted, the app source configuration chooses its default branch.',
            })
            .optional(),
        source_ref_type: Extract_AppVersionGitRefType_branch_tag_commitSchema.optional(),
        trigger: AppBuildTriggerSchema.optional(),
        target: AppVersionTargetSchema.optional(),
        title: z.string().optional(),
        description: z.string().optional(),
    })
    .meta({ id: 'StartAppBuildRequest' });

const openObjectSchema: z.ZodType<Record<string, unknown>> = z
    .any()
    .meta({ type: 'object', additionalProperties: true });

export const AgentToolDefinitionSchema = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        // `z.looseObject({})` emits `additionalProperties: {}`; the derived spelling of this same
        // component publishes `true`. They accept identical values, but the name is still derived
        // through `AppPackage`, so this reproduces the published form exactly.
        input_schema: openObjectSchema,
        output_schema: openObjectSchema
            .meta({
                description:
                    'Optional MCP outputSchema advertised by the provider for its structuredContent payload. Execution adapters may expose results differently.',
            })
            .optional(),
        url: z
            .string()
            .meta({
                description:
                    'The tool execution URL. It can be an absolute URL or a path in which case the URL is obtained using the base URL of the tool server API. Ex: http://tool-server.com/api/ Example of relative URLs: "tools/my-tool-collection" or "/api/tools/my-tool-collection"',
            })
            .optional(),
        category: z.string().meta({ description: 'The tool category if any - for UI purposes.' }).optional(),
        default: z
            .boolean()
            .meta({
                description:
                    'Whether this tool is available by default.\n- true/undefined: Tool is always available to agents\n- false: Tool is only available when enabled by a skill via `tools`',
            })
            .optional(),
        tools: z
            .array(z.string())
            .meta({
                description:
                    'For skill tools (`learn_*`): the tool names this skill enables when called. Matches the `tools:` key used in SKILL.md frontmatter and built-in skill definitions — one name across the whole stack.',
            })
            .optional(),
        keywords: z
            .array(z.string())
            .meta({
                description:
                    'For skill tools (`learn_*`): context-trigger keywords from SKILL.md frontmatter. Not included in primary-agent tool definitions; available to discovery and routing components.',
            })
            .optional(),
        annotations: MCPToolAnnotationsSchema.meta({
            description: 'MCP tool annotations providing hints about tool behavior and safety.',
        }).optional(),
        approval_class: AgentToolApprovalClassSchema.meta({
            description:
                'Approval classification used by interactive agent approval modes. Use `requires_confirmation` for actions that must prompt even in full-control mode.',
        }).optional(),
    })
    .meta({
        id: 'AgentToolDefinition',
        description: 'Tool definition with optional activation control for agent exposure.',
    });

export const AppDevelopmentTaskListSchema = z
    .strictObject({
        default_branch: z.string().meta({ description: 'Repository default branch, when resolvable.' }).optional(),
        tasks: z.array(AppDevelopmentTaskSchema),
    })
    .meta({
        id: 'AppDevelopmentTaskList',
        description: 'Git-backed development tasks and the branch used for new tasks by default.',
    });

// `AppInstallation` itself stays derived for now, and so do the two install slots that return it.
// `AppInstallationWithManifest`, `AppInstallationListEntry` and `OrphanedAppInstallation` are all
// declared as `Omit<AppInstallation, 'manifest'>`, and the scanner cannot read members off a type
// that is an alias of a schema — it sees the canonical name and stops. Those three are blocked on the
// manifest anyway, so all four convert together once `JSONSchema.type` is settled.

export const OAuthClientCredentialsMapSchema = z
    .object({})
    .catchall(OAuthClientCredentialsSchema)
    .meta({ id: 'OAuthClientCredentialsMap' });

export const AppOAuthCollectionParamsSchema = OAuthClientCredentialsMapSchema.meta({ id: 'AppOAuthCollectionParams' });

export const McpApiKeyCredentialSchema = z
    .strictObject({
        // Matches SetMcpApiKeyRequest, including the `\S` pattern — see the note there on why the
        // trim alone does not survive into the AJV-enforced JSON Schema.
        api_key: z
            .string()
            .trim()
            .min(1)
            .regex(/\S/, 'API key must not be blank')
            .meta({
                description:
                    'The key the installer holds for this collection. Surrounding whitespace is stripped. Stored ' +
                    'encrypted in the installing project and never returned.',
            }),
    })
    .meta({ id: 'McpApiKeyCredential' });

export const AppApiKeyCollectionParamsSchema = z
    .object({})
    .catchall(McpApiKeyCredentialSchema)
    .meta({ id: 'AppApiKeyCollectionParams' });

export const AppInspectionIssueSchema = z
    .strictObject({
        severity: z.enum(['error', 'warning']),
        capability: AppPackageScopeSchema.meta({
            description: "The capability this issue relates to, when applicable (e.g. 'types').",
        }).optional(),
        code: z.string().meta({
            description:
                "Stable machine code, e.g. 'capability_declared_but_empty', 'endpoint_unreachable', 'not_installed'.",
        }),
        message: z
            .string()
            .meta({ description: 'Human-readable explanation, safe to surface to the model and the UI.' }),
    })
    .meta({
        id: 'AppInspectionIssue',
        description: "A single diagnostic produced while inspecting an app's registration state.",
    });

export const AppScaffoldProgressSchema = z
    .strictObject({
        status: AppScaffoldProgressStatusSchema,
        step: z.string(),
        app_id: z.string().optional(),
        app_record_id: z.string().optional(),
        installation_id: z.string().optional(),
        git_url: z.string().optional(),
        files: z.number().optional(),
        initial_version_build: StartAppBuildResponseSchema.optional(),
        error: z.string().optional(),
        error_details: z.array(z.string()).optional(),
        updated_at: z.string(),
    })
    .meta({ id: 'AppScaffoldProgress' });

export const AppRepoTreeSchema = z
    .strictObject({
        ref: z
            .string()
            .meta({ description: 'The ref the listing was read at (empty/undefined = default branch / HEAD).' })
            .optional(),
        prefix: z
            .string()
            .meta({ description: 'The directory prefix that was listed (empty = repo root).' })
            .optional(),
        entries: z.array(AppRepoTreeEntrySchema),
    })
    .meta({ id: 'AppRepoTree', description: 'A non-recursive listing of an app git repo directory at a given ref.' });

export const AppRepoRefsSchema = z
    .strictObject({
        default_branch: z
            .string()
            .meta({ description: "The repository's default branch (HEAD target), when resolvable." })
            .optional(),
        branches: z.array(AppRepoRefSchema),
        tags: z.array(AppRepoRefSchema),
    })
    .meta({ id: 'AppRepoRefs', description: 'The branches and tags of an app git repo (see  {@link  AppRepoRef } ).' });

export const AppRepoCommitsSchema = z
    .strictObject({
        ref: z
            .string()
            .meta({
                description: 'Ref from which history traversal started (empty/undefined = default branch / HEAD).',
            })
            .optional(),
        path: z
            .string()
            .meta({ description: 'File path relative to the repository root, when history was filtered to a file.' })
            .optional(),
        commits: z.array(AppRepoCommitSchema).meta({ description: 'Commits ordered newest first.' }),
        next_cursor: z
            .string()
            .meta({ description: 'Pass this cursor to retrieve the next page. Absent when history is exhausted.' })
            .optional(),
    })
    .meta({
        id: 'AppRepoCommits',
        description: 'Commit history in an app git repository, optionally filtered to a file.',
    });

export const ContentObjectTypeRefSchema = z
    .discriminatedUnion('ref_type', [StoredTypeRefSchema, InCodeTypeRefSchema])
    .meta({ id: 'ContentObjectTypeRef' });

export const AppBuildProgressSchema = z
    .strictObject({
        status: AppBuildProgressStatusSchema,
        step: z.string(),
        app_id: z.string().optional(),
        version_id: z.string().optional(),
        source_ref: z.string().optional(),
        source_ref_type: Extract_AppVersionGitRefType_branch_tag_commitSchema.optional(),
        source_commit: z.string().optional(),
        file_count: z.number().optional(),
        app_url: z.string().optional(),
        error: z.string().optional(),
        updated_at: z.string(),
    })
    .meta({ id: 'AppBuildProgress' });

export const AppVersionStorageSchema = z
    .strictObject({
        tenant_id: z.string().optional(),
        app_prefix: z.string().optional(),
        artifacts_prefix: z.string().optional(),
        source_archive: z.string().optional(),
        source_git: AppVersionGitSourceSchema.optional(),
        build_prefix: z.string().optional(),
        manifest_path: z.string().optional(),
        service_archive: z.string().optional(),
        live_metadata_path: z.string().optional(),
    })
    .meta({ id: 'AppVersionStorage' });

export const AppToolCollectionSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The collection name' }),
        description: z.string().meta({ description: 'Optional collection description' }).optional(),
        tools: z.array(AgentToolDefinitionSchema).meta({ description: 'the tools provided by this collection' }),
    })
    .meta({ id: 'AppToolCollection', description: 'A description of the tools provided by an app' });

export const AppOAuthProviderParamsSchema = OAuthClientCredentialsMapSchema.meta({ id: 'AppOAuthProviderParams' });

export const AppInspectionResultSchema = z
    .strictObject({
        app_id: z.string(),
        name: z.string(),
        version: z.string().optional(),
        endpoint: z
            .string()
            .meta({ description: 'The resolved package endpoint for the current environment, if any.' })
            .optional(),
        endpoint_reachable: z
            .boolean()
            .meta({ description: 'True when the package endpoint responded to the capability probe.' }),
        installed: z.boolean().meta({ description: 'True when the app is installed in the current project.' }),
        access_control: z.string().optional(),
        capabilities: z
            .array(AppPackageScopeSchema)
            .meta({ description: 'The capabilities declared on the manifest.' }),
        package: z
            .array(AppInspectionCapabilityReportSchema)
            .meta({ description: 'What the promoted package exposes, per capability.' }),
        issues: z
            .array(AppInspectionIssueSchema)
            .meta({ description: 'Diagnostics — errors and warnings about the registration state.' }),
        probe_error: z
            .string()
            .meta({ description: 'Populated when the package probe itself failed (endpoint error/unreachable).' })
            .optional(),
    })
    .meta({
        id: 'AppInspectionResult',
        description:
            "Result of inspecting an app's registration: the resolved manifest state, what the promoted package actually exposes per capability, and diagnostics. This is the ground truth used by the `app_inspect_registration` agent tool and the Build › App inspection UI to verify what is registered vs declared, instead of inferring it from failed object/import calls.",
    });

export const AppVersionRecordSchema = z
    .strictObject({
        id: z.string(),
        account: z.string(),
        project: z.string(),
        app: z.string().optional(),
        app_id: z.string(),
        app_name: z.string(),
        version_id: z.string(),
        kind: AppVersionKindSchema,
        state: AppVersionStateSchema,
        promoted: z.boolean().optional(),
        target: AppVersionTargetSchema.optional(),
        agent_run_id: z.string().optional(),
        development_task_id: z
            .string()
            .meta({ description: 'Development task that produced this version, when built by the app assistant.' })
            .optional(),
        build_workflow_id: z.string().meta({ description: 'Temporal workflow that produced this version.' }).optional(),
        build_workflow_run_id: z.string().meta({ description: 'Temporal run that produced this version.' }).optional(),
        sandbox_id: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        storage: AppVersionStorageSchema.optional(),
        source_commit: z
            .string()
            .meta({ description: 'Exact Git commit used to build this immutable version.' })
            .optional(),
        urls: AppVersionUrlsSchema.optional(),
        manifest: z.looseObject({}).optional(),
        files: z.array(z.string()).optional(),
        file_count: z.number().optional(),
        source_file_count: z.number().optional(),
        screenshot_artifact: z.string().optional(),
        checks: z.array(z.string()).optional(),
        created_by: z.string().optional(),
        created_at: z.string(),
        updated_at: z.string(),
        built_at: z.string().optional(),
        checked_at: z.string().optional(),
        expires_at: z.string().optional(),
    })
    .meta({ id: 'AppVersionRecord' });

export const AgentRunSearchHitSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Agent run ID' }),
        score: z.number().meta({ description: 'Relevance score' }),
        interaction: z.string().meta({ description: 'Interaction ID' }).optional(),
        run_type: RunTypeSchema.meta({ description: 'Public-facing runtime mode' }).optional(),
        run_kind: RunKindSchema.meta({ description: 'Internal run discriminator' }).optional(),
        interaction_name: z.string().meta({ description: 'Human-readable interaction name' }).optional(),
        status: AgentRunStatusSchema.meta({ description: 'Current status' }),
        activity_state: ConversationActivityStateSchema.meta({
            description: 'Whether the agent is currently working or idle',
        }).optional(),
        started_at: z.string().meta({ description: 'When the run started' }),
        completed_at: z.string().meta({ description: 'When the run completed' }).optional(),
        started_by: z.string().meta({ description: 'Who started the run' }),
        title: z.string().meta({ description: 'Conversation title' }).optional(),
        topic: z.string().meta({ description: 'Conversation topic' }).optional(),
        lessons_learned: z.array(z.string()).meta({ description: 'Lessons learned from the conversation' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Tags' }).optional(),
        categories: z.array(z.string()).meta({ description: 'Categories' }).optional(),
        interactive: z.boolean().meta({ description: 'Whether the agent accepts user input' }),
        collection_id: z.string().meta({ description: 'Collection ID' }).optional(),
        content_type: ContentObjectTypeRefSchema.meta({ description: 'Content type' }).optional(),
        tool_names: z.array(z.string()).meta({ description: 'Tools configured for this run' }).optional(),
        schedule_id: z.string().meta({ description: 'Schedule ID (if schedule-triggered)' }).optional(),
        event_subscription_id: z
            .string()
            .meta({ description: 'Event subscription ID (if event-triggered)' })
            .optional(),
        event_ref: EventRefSchema.meta({ description: 'Event reference (if event-triggered)' }).optional(),
        source_type: AgentRunTypeSchema.meta({ description: 'How the run was created' }).optional(),
        type: AgentRunTypeSchema.meta({
            description: 'Deprecated: Use source_type for creation source and run_type for runtime mode.',
            deprecated: true,
            'x-deprecated-message': 'Use source_type for creation source and run_type for runtime mode.',
        }).optional(),
        created_at: z.string().meta({ description: 'Created timestamp' }),
        updated_at: z.string().meta({ description: 'Updated timestamp' }),
    })
    .meta({ id: 'AgentRunSearchHit', description: 'A single search hit from Elasticsearch.' });

export const UpsertAppVersionRequestSchema = z
    .strictObject({
        record_id: z
            .string()
            .meta({ description: 'Existing version record to update in place, used by reproducible rebuilds.' })
            .optional(),
        app: z.string().optional(),
        app_id: z.string(),
        app_name: z.string().optional(),
        version_id: z.string(),
        kind: AppVersionKindSchema,
        state: AppVersionStateSchema.optional(),
        target: AppVersionTargetSchema.optional(),
        agent_run_id: z.string().optional(),
        development_task_id: z
            .string()
            .meta({ description: 'Development task that produced this version, when built by the app assistant.' })
            .optional(),
        build_workflow_id: z.string().optional(),
        build_workflow_run_id: z.string().optional(),
        sandbox_id: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        storage: AppVersionStorageSchema.optional(),
        source_commit: z
            .string()
            .meta({ description: 'Exact Git commit used to build this immutable version.' })
            .optional(),
        urls: AppVersionUrlsSchema.optional(),
        manifest: z.looseObject({}).optional(),
        files: z.array(z.string()).optional(),
        file_count: z.number().optional(),
        source_file_count: z.number().optional(),
        screenshot_artifact: z.string().optional(),
        checks: z.array(z.string()).optional(),
        built_at: z.string().optional(),
        checked_at: z.string().optional(),
        expires_at: z.string().optional(),
    })
    .meta({ id: 'UpsertAppVersionRequest' });

export const AppInstallationPayloadSchema = z
    .strictObject({
        app_id: z.string(),
        settings: z.looseObject({}).optional(),
        access_control: z
            .union([AppAccessControlSchema, z.null()])
            .meta({
                description:
                    "Per-installation override of the manifest's `access_control` policy. When provided, takes precedence over the manifest default for every access check. Sibling of `settings` — admin-controlled, not part of the app's own settings JSON.\n\nThree send-time semantics on update:  - Field omitted entirely from the payload → leave the existing override unchanged.  - Explicit `null` → clear the override, fall back to the manifest default.  - String enum → set the override to that value.\n\n(On install, the same shape applies; omit or pass `null` to use the manifest default.)",
            })
            .optional(),
        oauth_params: AppOAuthCollectionParamsSchema.meta({
            description:
                'OAuth credentials for each collection, keyed by collection.id. Legacy callers may still use collection.name for older manifests. Collected from the user at install time for collections with oauth_config.required_at_install.',
        }).optional(),
        oauth_provider_params: AppOAuthProviderParamsSchema.meta({
            description:
                'OAuth credentials for named providers, keyed by the provider key from oauth_providers. Collected from the user at install time for providers with required_at_install. Separate from oauth_params to avoid key collisions between provider keys and collection ids.',
        }).optional(),
        api_key_params: AppApiKeyCollectionParamsSchema.meta({
            description:
                "API keys for auth: 'api_key' collections, keyed by collection.id. Collected from the user at " +
                'install time for collections with api_key_config.required_at_install. Each key is stored in the ' +
                "installing project's encrypted secret store, replacing any key already held for that collection.",
        }).optional(),
    })
    .meta({ id: 'AppInstallationPayload' });

export const AppDevelopmentTaskDetailsSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Task slug derived from the branch name.' }),
        branch: z.string().meta({ description: 'Complete Git branch name.' }),
        source_commit: z.string().meta({ description: 'Commit currently at the branch head.' }),
        commit_date: z.string().meta({ description: 'Branch-head commit date, when available.' }).optional(),
        agent_run: AgentRunSearchHitSchema.meta({
            description: 'Latest App Builder parent run started for this task branch.',
        }).optional(),
    })
    .meta({
        id: 'AppDevelopmentTaskDetails',
        description: 'Development task details, including the latest parent assistant run when one exists.',
    });

export const AppVersionRecordArraySchema = z.array(AppVersionRecordSchema).meta({ id: 'AppVersionRecordArray' });

export const AppToolCollectionArraySchema = z.array(AppToolCollectionSchema).meta({ id: 'AppToolCollectionArray' });

// Query contracts are registry components even though the scanner expands them into parameters.

// `AppInstallationKind` has a TypeScript name and therefore gets a reusable component of its own.
export const AppInstallationKindSchema = z
    .enum(['ui', 'tools', 'all'])
    .meta({ id: 'AppInstallationKind', description: 'Which app contributions an installation listing is for.' });

// `AppListScope` has a TypeScript name and therefore gets a reusable component of its own.
export const AppListScopeSchema = z.enum(['account', 'project']).meta({
    id: 'AppListScope',
    description: 'Which apps an app listing covers.',
});

export const AppsQuerySchema = z
    .strictObject({
        scope: AppListScopeSchema.meta({
            description:
                'Restrict the listing to apps that belong to the current project — those installed ' +
                'into it or that have built versions in it. Defaults to `account`, which lists every ' +
                'app visible to the account, including the public catalog.',
        }).optional(),
    })
    .meta({ id: 'AppsQuery' });

export const AppInstallationsQuerySchema = z
    .strictObject({
        kind: AppInstallationKindSchema.meta({
            description: 'Which contributions the listing is for. Defaults to `all`.',
        }).optional(),
        available_in: AppAvailableInSchema.meta({
            description: 'Restrict to installations whose manifest declares this surface.',
        }).optional(),
    })
    .meta({ id: 'AppInstallationsQuery' });

export const AppInstallationProjectsQuerySchema = z
    .strictObject({
        name: z.string().meta({ description: 'App manifest name. One of `name` or `id` is required.' }).optional(),
        id: z.string().meta({ description: 'App manifest id. One of `name` or `id` is required.' }).optional(),
    })
    .meta({
        id: 'AppInstallationProjectsQuery',
        description:
            'Exactly one of `name` or `id` identifies the app. Neither is required by the component ' +
            'because the endpoint answers 400 for the empty case with a message naming both.',
    });

export const SystemPackageQuerySchema = z
    .strictObject({
        scope: z
            .array(AppPackageScopeSchema)
            .meta({
                description:
                    'Which capabilities to include in the returned package. Defaults to `all`. ' +
                    'Comma-joined (`?scope=ui,tools`) or repeated.',
            })
            .optional(),
    })
    .meta({ id: 'SystemPackageQuery' });
