import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { ResourceVisibility } from '../project-values.js';

/**
 * Runtime API schemas for the leaves of the `ProjectConfiguration` closure — the ninth batch.
 *
 * `Project` and `ProjectConfiguration` themselves are NOT here. They reach
 * `InteractionExecutionConfiguration` (and through it the intake policy tree in `../store/store.ts`),
 * which is its own slice of work; what converts here is everything under the configuration that
 * depends on nothing outside this module. Each of these is a published component today, hoisted by
 * `ProjectConfiguration` rather than named by an endpoint, so converting them changes no slot — it
 * removes the TypeScript declaration as the source of a contract and lets the two remaining
 * configuration components convert against canonical `$ref`s.
 *
 * Descriptions are the ones the derived components already carry, moved from TSDoc onto the schema:
 * the published document is what has to stay unchanged, and `.meta()` is where a canonical component
 * gets its description from.
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

export const ProjectSearchPropertyTypeSchema = z.enum(['keyword', 'text', 'boolean', 'long', 'double', 'date']).meta({
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
                    'and date mappings.',
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
