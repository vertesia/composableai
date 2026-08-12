import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { ResourceVisibility } from '../project-values.js';
import { ContentTypeIntakePolicySchema } from './store.js';

/**
 * Runtime API schemas for project configuration and its nested policies.
 */

export const ModelDefaultSchema = z
    .object({
        environment: z.string(),
        model: z.string(),
    })
    .meta({ id: 'ModelDefault', description: 'Environment and model pair for a default configuration.' });

export const ModalityDefaultsSchema = z
    .object({
        image: ModelDefaultSchema.optional().meta({ description: 'Override for inputs containing images' }),
        video: ModelDefaultSchema.optional().meta({
            description: 'Override for inputs containing video (requires video-capable model)',
        }),
    })
    .meta({
        id: 'ModalityDefaults',
        description:
            'Modality-specific default model overrides. These override the base default when specific input ' +
            'modalities are detected.',
    });

/**
 * One optional default per system interaction category.
 *
 * The interface spelled this as a mapped type over `SystemInteractionCategory`, so adding a category
 * widened it for free. Zod cannot infer a useful type from a computed key set, so the categories are
 * written out — and `project.contract.test.ts` asserts that `keyof SystemDefaults` is exactly the
 * category union, which is what keeps a new category from being silently absent here.
 */
export const SystemDefaultsSchema = z
    .object({
        content_type: ModelDefaultSchema.optional(),
        intake: ModelDefaultSchema.optional(),
        analysis: ModelDefaultSchema.optional(),
        agent: ModelDefaultSchema.optional(),
        non_applicable: ModelDefaultSchema.optional(),
    })
    .meta({ id: 'SystemDefaults' });

export const ProjectModelDefaultsSchema = z
    .object({
        base: ModelDefaultSchema.optional().meta({
            description: 'Base default model - used when no other default applies',
        }),
        modality: ModalityDefaultsSchema.optional().meta({
            description:
                'Modality-based overrides (image, video) - override base when specific input modalities detected',
        }),
        system: SystemDefaultsSchema.optional().meta({ description: 'System interaction category defaults' }),
    })
    .meta({ id: 'ProjectModelDefaults', description: 'Extensible project defaults using map/dictionary pattern.' });

/** Reads the enum rather than restating its members, like {@link SupportedIntegrationsSchema}. */
export const ResourceVisibilitySchema = z.enum(ResourceVisibility).meta({ id: 'ResourceVisibility' });

export const ProjectSearchTierSchema = z.enum(['standard', 'performance']).meta({ id: 'ProjectSearchTier' });

export const ElasticsearchBackendSchema = z.enum(['serverless', 'hosted']).meta({ id: 'ElasticsearchBackend' });

export const ProjectSearchPropertyTypeSchema = z
    .enum(['keyword', 'text', 'boolean', 'long', 'double', 'date', 'geo_point'])
    .meta({
        id: 'ProjectSearchPropertyType',
        description:
            'Elasticsearch field types that may be explicitly assigned to content-object properties. Paths are ' +
            "relative to the object's `properties` field.",
    });

export const ProjectSearchPropertyMappingSchema = z
    .object({
        type: ProjectSearchPropertyTypeSchema,
        format: z
            .string()
            .optional()
            .meta({ description: 'Elasticsearch date format. Valid only when type is `date`.' }),
        ignore_above: z
            .number()
            .optional()
            .meta({ description: 'Maximum indexed string length. Valid only when type is `keyword`.' }),
        ignore_malformed: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Skip malformed values instead of rejecting the whole document. Valid only for long, double, ' +
                    'date, and geo_point mappings.',
            }),
    })
    .meta({
        id: 'ProjectSearchPropertyMapping',
        description:
            'Explicit search mapping for one content-object property.\n\nChanging a mapping requires a full ' +
            'reindex. Existing Elasticsearch fields cannot change type in place.',
    });

/**
 * The published name for `Record<string, ProjectSearchPropertyMapping>`.
 *
 * The property is inline in the interface and has no TypeScript name; the scanner synthesizes
 * `<Target>Map` for a record component, so the component exists and has to keep existing. It is
 * therefore registered without a public alias — a component name with no type of its own, like the
 * hoisted `ModelOptions` members. Having no alias means it is never intercepted, so it stays
 * canonical AND derived and has to agree with its twin forever: hence the catchall spelling, which
 * the adapter emits without the `propertyNames` that `z.record` adds.
 */
export const ProjectSearchPropertyMappingMapSchema = z
    .object({})
    .catchall(ProjectSearchPropertyMappingSchema)
    .meta({ id: 'ProjectSearchPropertyMappingMap' });

export const AgentCheckpointConfigurationSchema = z
    .strictObject({
        context_threshold: z
            .number()
            .optional()
            .meta({
                description:
                    "Fraction of the model's context window to use before the conversation is summarized and " +
                    'compacted (0-1, e.g. 0.95). Model-independent: applies to whatever model each run uses. ' +
                    'Setting it replaces the default hard cap — a project asking for 0.95 of a 1M-window model ' +
                    'checkpoints at 950k. Clamped at runtime to 0.95 so the prompt still fits.',
            }),
        max_tokens: z
            .number()
            .optional()
            .meta({
                description:
                    'Absolute hard cap in tokens, regardless of the window fraction. Alone it acts as the ' +
                    'threshold; combined with context_threshold the lower of the two wins. Clamped at runtime to ' +
                    "95% of the model's window. Unset means the default cap (500k), or no cap beyond the 95% " +
                    'clamp when context_threshold is set.',
            }),
    })
    .meta({ id: 'AgentCheckpointConfiguration' });

export const AgentProjectConfigurationSchema = z
    .strictObject({
        checkpoint: AgentCheckpointConfigurationSchema.optional().meta({
            description: 'Conversation checkpoint (context compaction) tuning.',
        }),
    })
    .meta({
        id: 'AgentProjectConfiguration',
        description:
            'Agent runtime configuration, scoped under project configuration so agent settings have one home ' +
            '(`configuration.agent`).',
    });

export const ProjectIndexingConfigurationSchema = z
    .object({
        enabled: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Enable indexing for content objects in this project. When enabled, content changes trigger ' +
                    'indexing workflows. Defaults to true - indexing is always on when ES infrastructure is available.',
            }),
        search_tier: ProjectSearchTierSchema.optional().meta({
            description:
                'Search tier for this project. standard uses the regional hosted Elasticsearch deployment. ' +
                'performance uses the regional serverless Elasticsearch project. Defaults to standard when omitted.',
        }),
        backend: ElasticsearchBackendSchema.optional().meta({
            description:
                'Elasticsearch backend override for this project. Prefer search_tier for project configuration ' +
                'unless an explicit backend override is needed.',
        }),
        property_mappings: ProjectSearchPropertyMappingMapSchema.optional().meta({
            description:
                'Explicit mappings for selected content-object property paths.\n\nKeys are dot-separated paths ' +
                'relative to `properties`, for example `order_total` or `customer.account_number`. Unlisted fields ' +
                'are mapped dynamically from their JSON values. Changing this value requires a full reindex.',
        }),
    })
    .meta({ id: 'ProjectIndexingConfiguration' });

export const ProjectConfigurationEmbeddingSchema = z
    .object({
        environment: z.string().optional(),
        enabled: z.boolean(),
        dimensions: z.number().optional(),
        max_tokens: z.number().optional(),
        model: z.string().optional(),
    })
    .meta({ id: 'ProjectConfigurationEmbedding' });

export const BrowserUseRiskPolicySchema = z
    .enum(['read_only', 'low_write', 'requires_approval', 'unrestricted'])
    .meta({ id: 'BrowserUseRiskPolicy' });

export const BrowserUseScreenshotCaptureSchema = z
    .enum(['off', 'on_action', 'each_turn'])
    .meta({ id: 'BrowserUseScreenshotCapture' });

/**
 * Project defaults and caps for `browser_use` agent workstreams.
 *
 * This shape used to be stated three times: the interface, the published component derived from it,
 * and a hand-written `JSONSchemaType<BrowserUseProjectConfiguration>` beside it in `../project.ts`
 * whose descriptions had already drifted from the TSDoc. The AJV schema is gone; this is the one
 * statement, and {@link import('./registry.js').validateApiRequest} compiles it.
 */
export const BrowserUseProjectConfigurationSchema = z
    .object({
        enabled: z.boolean().optional().meta({
            description: 'Enable the browser_use workflow-level tool for this project. Defaults to true when omitted.',
        }),
        default_policy: BrowserUseRiskPolicySchema.optional().meta({
            description: 'Risk policy used when the tool call does not specify one. Defaults to low_write.',
        }),
        max_policy: BrowserUseRiskPolicySchema.optional().meta({
            description:
                'Maximum policy a tool call may request. Requested policies above this are clamped down to the ' +
                'project maximum. Defaults to unrestricted.',
        }),
        allowed_hosts: z
            .array(z.string())
            .optional()
            .meta({
                description:
                    'Optional project-wide host allowlist. When present, browser_use calls can only request hosts ' +
                    'contained by this list.',
            }),
        allow_file_uploads: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Allow saved Playwright scripts to hydrate artifacts/documents as files inside the browser ' +
                    'sandbox for upload flows. Defaults to true.',
            }),
        allow_playwright_scripts: z.boolean().optional().meta({
            description: 'Allow the browser_playwright_script tool in browser workstreams. Defaults to true.',
        }),
        capture_screenshots: BrowserUseScreenshotCaptureSchema.optional().meta({
            description: 'Persist browser screenshots for UI progress. Defaults to on_action.',
        }),
        prefer_raw_screenshots: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Prefer unannotated screenshots in the browser-use UI widget when both raw and annotated ' +
                    'captures are available. Defaults to true.',
            }),
    })
    .meta({ id: 'BrowserUseProjectConfiguration' });

export const ProjectIntakeSniffConfigurationSchema = z
    .object({
        enabled: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Enable the pre-conversion sniff for untyped documents. Defaults to true. Can be overridden ' +
                    'per run with the `sniffEnabled` workflow var.',
            }),
        high_confidence: z
            .number()
            .optional()
            .meta({
                description:
                    'Confidence at or above which the sniffed type is committed and its full policy applied ' +
                    '(including conversion-skip). 0..1, defaults to 0.85.',
            }),
        medium_confidence: z
            .number()
            .optional()
            .meta({
                description:
                    'Confidence at or above which the sniffed type is treated as provisional: the document still ' +
                    'converts and the post-conversion selector confirms on neutral evidence. 0..1, defaults to 0.6. ' +
                    'Below this the sniff result is advisory provenance only.',
            }),
        min_pages: z
            .number()
            .optional()
            .meta({
                description:
                    'Minimum page count for the sniff LLM call. Below this, conversion is cheap and full converted ' +
                    'text is better selection evidence, so intake uses the standard convert-then-select path. ' +
                    'Documents with unknown page counts are sniffed. Defaults to 5; 0 means always sniff.',
            }),
    })
    .meta({
        id: 'ProjectIntakeSniffConfiguration',
        description:
            'Fast pre-conversion type identification (the "sniff") for untyped documents. The sniff classifies a ' +
            'document from cheap local evidence (first/last page text, a low-res first-page image, office ' +
            "docProps) BEFORE any conversion, so a high-confidence match can apply the type's intake policy — " +
            'including skipping conversion — without paying for it first.',
    });

/**
 * A project's override for one platform vision profile.
 *
 * Nothing on the wire holds a complete profile: platform defaults supply what a project leaves out.
 */
export const IntakeVisionProfileSettingsUpdateSchema = z
    .strictObject({
        dpi: z.number().optional().meta({ description: 'Render resolution in dots per inch.' }),
        max_hw: z
            .number()
            .optional()
            .meta({ description: 'Maximum height/width of the rendered page image in pixels.' }),
        quality: z.number().optional().meta({ description: 'JPEG quality (0-100).' }),
        color_mode: z.enum(['grayscale', 'auto']).optional().meta({
            description: 'grayscale renders gray always; auto keeps color when the plan asks for it.',
        }),
    })
    .meta({ id: 'IntakeVisionProfileSettingsUpdate' });

/**
 * Per-detail-name overrides, spelled out rather than written over the `IntakeVisionDetail` enum.
 *
 * `Partial<Record<IntakeVisionDetail, …>>` is what the TypeScript said, and this schema is why that
 * declaration had to stop being the source: once `IntakeVisionDetail` became a canonical alias it is
 * opaque to the schema generator, which then cannot enumerate the mapped type's keys and fails with
 * `Unexpected key type "def-canonical-alias-IntakeVisionDetail"`. Converting the map is what unblocks
 * `ProjectConfiguration` and `Project` above it.
 *
 * The three keys are therefore restated here. They are checked against the enum in
 * `project.contract.test.ts` rather than derived from it, so adding a detail name to the platform
 * fails a test instead of silently publishing a map that cannot hold it.
 */
export const IntakeVisionProfileSettingsMapSchema = z
    .strictObject({
        low: IntakeVisionProfileSettingsUpdateSchema.optional(),
        standard: IntakeVisionProfileSettingsUpdateSchema.optional(),
        high: IntakeVisionProfileSettingsUpdateSchema.optional(),
    })
    .meta({ id: 'IntakeVisionProfileSettingsMap' });

export const ProjectIntakeConfigurationSchema = z
    .strictObject({
        enabled: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Master switch for the standard intake pipeline. When false, StandardIntake exits as a ' +
                    'no-op WITHOUT touching object status (objects stay in `created`, identifiable as ' +
                    'unprocessed). Defaults to true.',
            }),
        sniff: ProjectIntakeSniffConfigurationSchema.optional().meta({
            description:
                'Fast pre-conversion type identification for untyped documents. Absent means enabled with ' +
                'platform default thresholds.',
        }),
        default_policy: ContentTypeIntakePolicySchema.optional().meta({
            description:
                "Project-level intake policy defaults. Same shape as the per-content-type policy; a type's " +
                '`intake` block wins field-by-field over these defaults, which in turn win over the legacy flat ' +
                'fields below. `identification` is type-specific and ignored here.',
        }),
        vision_profiles: IntakeVisionProfileSettingsMapSchema.optional().meta({
            description:
                'Project overrides for the platform vision detail profiles used by intake visual extraction ' +
                '(`low`/`standard`/`high`). Partial: omitted profiles or fields inherit the platform defaults. ' +
                'Types reference detail NAMES only; the profile settings live here.',
        }),
        generate_toc: z.boolean().optional().meta({
            description: 'Generate table-of-content sections during standard document intake. Defaults to false.',
        }),
        generate_toc_max_size: z
            .number()
            .optional()
            .meta({
                description:
                    'Skip table-of-content generation when the document text exceeds this many characters. ' +
                    'Avoids sending very large documents through the TOC interactions. Unset means no limit.',
            }),
        generate_content_type: z.boolean().optional().meta({
            description: 'Select or assign a content type during standard intake. Defaults to true.',
        }),
        generate_properties: z.boolean().optional().meta({
            description: 'Extract document properties after content type assignment. Defaults to true.',
        }),
        default_content_type: z
            .string()
            .optional()
            .meta({
                description:
                    'Default content type assigned during intake when type selection finds no matching type. A ' +
                    'type id resolvable in this project (a stored `oid:` type, an `app:` type, or a `sys:` type). ' +
                    'Defaults to the platform `sys:GenericDocument` when unset.',
            }),
    })
    .meta({ id: 'ProjectIntakeConfiguration' });

/**
 * The project configuration, and with it the last two components of the `Project` closure.
 *
 * Every leaf above is already canonical, so this is the join: a canonical component may not `$ref` a
 * TypeScript-derived one, and there is nothing derived left underneath.
 *
 * `embeddings` is spelled out inline rather than named, because the derived component published it
 * inline — the TypeScript declaration used an anonymous object literal, so the scanner never minted a
 * component for it. Naming it here would ADD a component to the document and change every consumer's
 * generated code for a shape that has not changed. It stays `strictObject` for the same reason: the
 * published shape is closed.
 *
 * `embeddings` is also the only required field, which is what makes `ProjectConfiguration` unusual —
 * a project written before the field existed has no embeddings block at all. The response mapper in
 * studio-server supplies `{}` rather than omitting it, so the response satisfies the component it
 * has always claimed to satisfy.
 */
export const ProjectConfigurationSchema = z
    .strictObject({
        default_environment: z.string().optional(),
        default_model: z.string().optional(),
        human_context: z.string().optional(),
        defaults: ProjectModelDefaultsSchema.optional(),
        default_visibility: ResourceVisibilitySchema.optional(),
        sync_content_properties: z.boolean().optional(),
        embeddings: z.strictObject({
            text: ProjectConfigurationEmbeddingSchema.optional(),
            image: ProjectConfigurationEmbeddingSchema.optional(),
            properties: ProjectConfigurationEmbeddingSchema.optional(),
        }),
        datacenter: z.string().optional(),
        storage_bucket: z.string().optional(),
        agent_streaming_enabled: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Enable real-time streaming of agent LLM responses to clients. When enabled, LLM responses ' +
                    'are streamed chunk-by-chunk via Redis pub/sub. Defaults to true if not specified.',
            }),
        agent: AgentProjectConfigurationSchema.optional().meta({
            description: 'Agent runtime configuration for this project.',
        }),
        indexing: ProjectIndexingConfigurationSchema.optional().meta({
            description:
                'Indexing configuration for this project. Controls whether indexing and querying are enabled ' +
                'at the project level.',
        }),
        intake: ProjectIntakeConfigurationSchema.optional().meta({
            description: 'Standard content intake behavior.',
        }),
        main_language: z
            .string()
            .optional()
            .meta({
                description:
                    "Primary language for full-text search analysis. ISO 639-1 code (e.g., 'en', 'fr', 'ja', " +
                    "'de'). Determines which Elasticsearch analyzer is used for the text field. Defaults to 'en' " +
                    '(English/standard analyzer).\n\nChanging this value requires a full reindex to take effect.',
            }),
        browser_use: BrowserUseProjectConfigurationSchema.optional().meta({
            description: 'Project defaults and caps for browser_use agent workstreams.',
        }),
        // Nullable because `null` is how this field is cleared, and because it is already stored that
        // way. `UpdateProjectConfiguration` merges every key whose value is not `undefined`, so the
        // settings UI turns the custom template off by sending an explicit `null` — the only spelling
        // available to it, since an omitted key means "leave unchanged" on a partial update. Declaring
        // it `string` alone made that request a 400, so the toggle could be switched on and never off,
        // and made every read of a project already carrying a `null` fail its response check.
        pdf_template_object_id: z
            .string()
            .nullable()
            .optional()
            .meta({
                description:
                    'Object ID of a content object containing a custom LaTeX template (.latex file) to use as ' +
                    'the branded PDF template. When set, "Export as Branded PDF" uses this template instead of ' +
                    'the built-in Vertesia default template. `null` clears it.',
            }),
    })
    .meta({ id: 'ProjectConfiguration' });
