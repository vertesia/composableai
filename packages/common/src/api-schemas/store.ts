import { HttpTimeoutOptionsSchema, ModelOptionsSchema, PromptCacheModeSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
// From the values module, for the reason `./apikey.js` gives.
import { ConfigModes, RunDataStorageLevel } from '../interaction-values.js';
import { EditRevisionSchema, ExpectedEditRevisionSchema } from './schema-primitives.js';

/**
 * Runtime API schemas for the content-intake policy tree.
 *
 * `ContentTypeIntakePolicy` was stated three times before this: the interface in `../store/store.ts`,
 * the component the scanner derived from it, and a 287-line hand-written
 * `JSONSchemaType<ContentTypeIntakePolicy>` beside the interface, compiled by zeno-server, by a
 * workflow tool and by the intake-policy editor. This module is now the only authored
 * statement; the JSON that AJV and Monaco need is generated from it through the same adapter that
 * produces the OpenAPI components — see `../store/intake-policy-schema.generated.ts`.
 *
 * The hand-written schema was also more permissive than the contract it was supposed to enforce: it
 * carried `nullable: true` on 112 subschemas, and AJV honours that keyword for OpenAPI
 * compatibility, so 101 of them accepted an explicit `null` that neither the TypeScript type nor the
 * published component allows. (The other 11 are enum-valued and rejected `null` regardless.) The
 * fields below are OPTIONAL and not nullable, which is what the type and the document have always
 * said — recorded as a runtime tightening in operation 25 of the 1.5 runbook.
 *
 * It was more permissive in three further ways, all of which this module also closes because the
 * PUBLISHED component already stated the stricter contract: it left the four
 * `InteractionExecutionConfiguration` slots (and `http_timeout` inside them) open to unknown keys,
 * left `model_options` an unconstrained object rather than the `ModelOptions` union, and left
 * `configMode`/`run_data` unconstrained strings rather than their enums.
 *
 * In ONE direction it was stricter, and that is a regression to guard against rather than a
 * tightening to record: it carried `type: 'integer'` on ten page/DPI counters and numeric bounds on
 * eighteen fields, none of which the published component ever stated. Those are restored below with
 * `z.int32()` and `.min()`/`.max()`, so the document finally publishes the constraints the server has
 * enforced all along. `packages/workflows/src/activities/intake-policy-schema.test.ts` is the parity
 * suite that caught their absence.
 *
 * `strictObject` throughout, including the inline nested objects: every one of them is published
 * `additionalProperties: false` today, and plain `z.object` would PARSE an unknown key by silently
 * dropping it.
 */

export const IntakeVisionDetailSchema = z.enum(['low', 'standard', 'high']).meta({
    id: 'IntakeVisionDetail',
    description:
        'Vision detail level names referenced by intake policies. The rendering profiles behind the names ' +
        '(dpi, max size, quality, color mode) are PLATFORM-defined and project-overridable — a type only ever ' +
        'references a detail name.',
});

export const IntakePageScopeSchema = z.enum(['all', 'located']).meta({
    id: 'IntakePageScope',
    description:
        'Named page scope for intake conversion/extraction: everything or the locate-pass result. Static page ' +
        'ranges live in the sibling `page_ranges` field (which wins when set) — kept as a SEPARATE field because ' +
        'scalar-or-collection unions generate unstable API clients.',
});

/**
 * Inclusive `[start, end]` pairs.
 *
 * `z.array(z.int32()).min(2).max(2)` rather than `z.tuple([...])`: the published component is `items`
 * with `minItems`/`maxItems`, which is how the scanner rendered the tuple, and a Zod tuple emits
 * `prefixItems` instead. Same accepted values, different spelling — and the spelling is what generated
 * Java and Go clients are built from, so it stays. The cost is that the inferred type widens from
 * `[number, number][]` to `number[][]`, which is recorded with the other SDK type corrections.
 */
export const IntakePageRangesSchema = z.array(z.array(z.int32()).min(2).max(2)).meta({
    id: 'IntakePageRanges',
    description:
        'Static page ranges: inclusive [start, end] pairs; negative indexes count from the end of the ' +
        'document ([[1, 2], [-1, -1]] = first two pages plus the last page).',
});

export const RunDataStorageLevelSchema = z.enum(RunDataStorageLevel).meta({ id: 'RunDataStorageLevel' });

export const ConfigModesSchema = z.enum(ConfigModes).meta({ id: 'ConfigModes' });

export const InteractionExecutionConfigurationSchema = z
    .strictObject({
        id: z.string().optional(),
        environment: z.string().optional(),
        model: z.string().optional(),
        do_validate: z.boolean().optional(),
        run_data: RunDataStorageLevelSchema.optional(),
        configMode: ConfigModesSchema.optional(),
        model_options: ModelOptionsSchema.optional(),
        prompt_cache_key: z
            .string()
            .optional()
            .meta({ description: 'Stable provider-side routing key for automatic prompt caching.' }),
        prompt_cache_mode: PromptCacheModeSchema.optional().meta({
            description:
                'Controls provider-side explicit caching: auto falls back safely, off disables it, and required ' +
                'surfaces cache preparation failures for diagnostics.',
        }),
        prompt_cache_ttl_seconds: z
            .number()
            .int()
            .min(60)
            .optional()
            .meta({
                description:
                    'Caller-selected explicit cache lifetime in seconds. Defaults remain provider-specific; ' +
                    'Vertex Gemini requires at least 60 seconds.',
            }),
        prompt_cache_schema_suffix: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Put the result schema after the cached prefix; Vertesia still validates the returned JSON ' +
                    'against it.',
            }),
        http_timeout: HttpTimeoutOptionsSchema.optional().meta({
            description: 'Per-run HTTP timeouts for upstream LLM-provider calls.',
        }),
    })
    .meta({ id: 'InteractionExecutionConfiguration' });

export const ContentTypeExtractionGroundingReviewPolicySchema = z
    .strictObject({
        enabled: z
            .boolean()
            .optional()
            .meta({ description: 'Set false to disable an inherited grounding review pass for this type.' }),
        config: InteractionExecutionConfigurationSchema.optional().meta({
            description: 'Model execution configuration for the review interaction.',
        }),
        threshold: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .meta({ description: 'Hardness score at or above which review runs. Defaults to hardness_threshold.' }),
        coverage_threshold: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .meta({
                description:
                    "Review also runs when any page's citation coverage falls below this floor (evidence of " +
                    'missed content). Default 0.2.',
            }),
        force: z.boolean().optional().meta({ description: 'Run review regardless of hardness.' }),
    })
    .meta({ id: 'ContentTypeExtractionGroundingReviewPolicy' });

export const ContentTypeExtractionGroundingPolicySchema = z
    .strictObject({
        enabled: z
            .boolean()
            .optional()
            .meta({ description: 'Enable PDF block-level citation grounding for property extraction.' }),
        interaction: z
            .string()
            .optional()
            .meta({ description: 'Grounded extraction interaction. Defaults to the system grounded extractor.' }),
        max_pages: z.int32().min(1).optional().meta({ description: 'Maximum pages to process.' }),
        force_ocr: z.boolean().optional().meta({ description: 'Run OCR on every page even when a text layer exists.' }),
        use_vision: z
            .boolean()
            .optional()
            .meta({ description: 'Attach instrumented page images to the grounded extraction prompt.' }),
        raster_mode: z
            .enum(['vision', 'ocr'])
            .optional()
            .meta({
                description:
                    'How to read pages with no digital text layer (scans / image-only pages). ' +
                    "'vision' (default): read them off the page image and skip OCR. 'ocr': legacy path — OCR " +
                    'those pages and block-ground on the (lossy) OCR text.',
            }),
        grid_cell_pt: z
            .number()
            .min(1)
            .optional()
            .meta({
                description:
                    'A1 locate-grid cell size in PDF points for vision pages. Smaller = finer grid (more cells, ' +
                    'tighter boxes) but can trip weaker models into over-reading; tune per the model in `config`. ' +
                    'Default 15.',
            }),
        omit_block_boxes: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Drop block bounding boxes from the extraction prompt. Only sound with use_vision (layout ' +
                    'comes from the image).',
            }),
        window_pages: z
            .int32()
            .min(1)
            .optional()
            .meta({ description: 'Maximum pages per grounded extraction call before windowing.' }),
        update_properties: z
            .boolean()
            .optional()
            .meta({ description: 'Update object properties with grounded extraction data. Default true.' }),
        config: InteractionExecutionConfigurationSchema.optional().meta({
            description: 'Model execution configuration for the main grounded extraction interaction.',
        }),
        hard_config: InteractionExecutionConfigurationSchema.optional().meta({
            description: 'Model execution configuration used for hard-to-read content.',
        }),
        hardness_threshold: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .meta({ description: 'Hardness score at or above which hard_config is used. Default 0.5.' }),
        min_citation_density: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .meta({
                description:
                    'Minimum citations-per-leaf-value ratio; completions below it retry with escalation. ' +
                    'Default 0.3.',
            }),
        refresh_ocr: z.boolean().optional().meta({
            description: 'Re-run OCR instead of restoring durable OCR artifacts (stale pipeline output).',
        }),
        review: ContentTypeExtractionGroundingReviewPolicySchema.optional().meta({
            description: 'Optional post-extraction review pass.',
        }),
    })
    .meta({ id: 'ContentTypeExtractionGroundingPolicy' });

/**
 * Per-type embedding switches.
 *
 * It has no standalone public TypeScript type, so it is registered without a public alias.
 */
export const EmbeddingTypeEnabledMapSchema = z
    .strictObject({
        text: z.boolean().optional(),
        image: z.boolean().optional(),
        properties: z.boolean().optional(),
    })
    .meta({ id: 'EmbeddingTypeEnabledMap' });

export const ContentTypeIntakePolicySchema = z
    .strictObject({
        mode: z
            .enum(['programmatic', 'agentic'])
            .optional()
            .meta({ description: 'Intake orchestration mode for this type.' }),
        identification: z
            .strictObject({
                guidance: z.string().optional(),
                distinguish_from: z.string().optional(),
                examples: z.array(z.string()).optional(),
            })
            .optional()
            .meta({ description: 'Guidance used when selecting or creating this content type.' }),
        locate: z
            .strictObject({
                instructions: z.string().meta({
                    description: 'What to look for ("commercial terms, payment schedule, signature pages").',
                }),
                detail: z.literal([8, 16]).optional().meta({
                    description: 'Pages per contact sheet: 8 = bigger tiles (headings readable). Default 16.',
                }),
                min_pages: z
                    .int32()
                    .min(0)
                    .optional()
                    .meta({ description: 'Only run when the page count is at least this. Default 8.' }),
            })
            .optional()
            .meta({
                description:
                    'Document-map ("locate") pass: page thumbnails tiled into labeled contact sheets, one vision ' +
                    'call returns which pages matter for THIS type. The result can scope conversion and ' +
                    'extraction, and doubles as the vision planner for visual extraction.',
            }),
        text_conversion: z
            .strictObject({
                enabled: z.boolean().optional(),
                method: z.enum(['auto', 'basic', 'llm', 'custom']).optional(),
                custom: z
                    .strictObject({
                        interaction: z.string().optional(),
                        agent: z.string().optional(),
                    })
                    .optional(),
                instructions: z.string().optional(),
                output_format: z.enum(['markdown', 'text']).optional(),
                scope: IntakePageScopeSchema.optional().meta({
                    description: 'Which pages to convert: everything or the locate result. Default all.',
                }),
                page_ranges: IntakePageRangesSchema.optional().meta({
                    description: 'Static page ranges to convert (wins over `scope` when set).',
                }),
                render_dpi: z
                    .int32()
                    .min(72)
                    .optional()
                    .meta({
                        description:
                            'DPI at which each page is rendered to the image the LLM converts. Default 150 — the ' +
                            'accuracy/cost sweet spot: higher resolutions balloon input tokens (some providers ' +
                            'tile the page) for no quality gain, below ~150 dense tables start to misread. Raise ' +
                            'only for very fine print.',
                    }),
                config: InteractionExecutionConfigurationSchema.optional().meta({
                    description:
                        "Model execution config for the page-conversion interaction (method 'llm'/'auto' -> " +
                        "sys:ConvertPageToMarkdown, method 'custom' -> the custom interaction). Lets the visual " +
                        'conversion run on a cheaper/faster model (e.g. a flash model) than extraction. When ' +
                        "unset, conversion uses the run's model config or the project default model.",
                }),
            })
            .optional()
            .meta({ description: 'Controls source-to-text conversion before extraction and embedding.' }),
        extraction: z
            .strictObject({
                enabled: z.boolean().optional(),
                source: z.enum(['auto', 'text', 'vision', 'mixed']).optional(),
                instructions: z.string().optional(),
                interaction: z.string().optional(),
                config: InteractionExecutionConfigurationSchema.optional().meta({
                    description:
                        'Model execution config for the standard property-extraction interaction ' +
                        '(sys:ExtractInformation). Lets extraction run on a different model/environment than the ' +
                        "visual page conversion. When unset, extraction uses the run's model config or the " +
                        'project default model. (Grounded extraction is configured separately via ' +
                        'grounding.config.)',
                }),
                scope: IntakePageScopeSchema.optional().meta({
                    description: 'Which pages extraction sees: everything or the locate result.',
                }),
                page_ranges: IntakePageRangesSchema.optional().meta({
                    description: 'Static page ranges extraction sees (wins over `scope` when set).',
                }),
                max_pages: z
                    .int32()
                    .min(1)
                    .optional()
                    .meta({ description: 'Cap on pages sent to extraction. Default 20.' }),
                vision: z
                    .strictObject({
                        default_detail: IntakeVisionDetailSchema.optional(),
                        allowed_details: z.array(IntakeVisionDetailSchema).optional(),
                        max_image_tokens: z.int32().min(1).optional().meta({
                            description: 'PRIMARY budget: estimated image tokens per extraction call. Default 16000.',
                        }),
                        max_payload_mb: z
                            .number()
                            .min(1)
                            .optional()
                            .meta({ description: 'Transport guard in megabytes. Default 16.' }),
                        max_pages_per_call: z
                            .int32()
                            .min(1)
                            .optional()
                            .meta({ description: 'Cap on page images per extraction call. Default 8.' }),
                    })
                    .optional()
                    .meta({
                        description:
                            'Vision evidence budget for visual extraction. Detail names reference platform ' +
                            'profiles; the type never defines dpi/quality/resolution.',
                    }),
                verification: z
                    .strictObject({
                        enabled: z.boolean().optional(),
                        model: z.string().optional(),
                        environment: z.string().optional(),
                        materiality: z.string().optional(),
                        threshold: z.number().min(0).max(1).optional(),
                        max_retries: z.int32().min(0).optional(),
                        on_fail: z.enum(['flag', 'block']).optional(),
                    })
                    .optional(),
                grounding: ContentTypeExtractionGroundingPolicySchema.optional().meta({
                    description: 'Controls PDF block-level citation grounding with annotated proof output.',
                }),
            })
            .optional()
            .meta({ description: 'Controls schema-property extraction after type assignment.' }),
        rendering_template: z.string().optional().meta({
            description: 'Handlebars template used to materialize extracted properties into object text.',
        }),
        embeddings: EmbeddingTypeEnabledMapSchema.optional().meta({
            description: 'Per-type embedding switches. Unspecified values inherit the project policy.',
        }),
        generate_toc: z.boolean().optional().meta({
            description: 'Whether intake should generate a table of contents for matching documents.',
        }),
        default_view: z
            .enum(['auto', 'text', 'pdf', 'image', 'properties'])
            .optional()
            .meta({ description: 'Preferred first view for objects of this type.' }),
    })
    .meta({
        id: 'ContentTypeIntakePolicy',
        description: 'Per-content-type policy for the standard intake workflows.',
    });

export const ColumnLayoutSchema = z
    .strictObject({
        field: z.string().meta({ description: 'The path of the field to use (e.g. "properties.title")' }),
        name: z.string().meta({ description: 'The name to display in the table column' }),
        type: z
            .string()
            .meta({
                description:
                    'The type of the field specifies how the rendering will be done. If not specified the string type will be used. The type may contain additional parameters prepended using a web-like query string syntax: date?LLL',
            })
            .optional(),
        fallback: z
            .string()
            .meta({ description: 'Path of an alternate field to display when the primary field is absent' })
            .optional(),
        default: z
            .unknown()
            .meta({ description: 'A default value to be used if the field is not present in the object' })
            .optional(),
    })
    .meta({ id: 'ColumnLayout' });

export const ContentTypeEditingPolicySchema = z
    .strictObject({
        interaction: z
            .string()
            .meta({
                description: 'Agent interaction used for new document-editing sessions. Defaults to sys:GeneralAgent.',
            })
            .optional(),
    })
    .meta({
        id: 'ContentTypeEditingPolicy',
        description: 'Per-content-type policy for collaborative document editing.',
    });

export const ContentObjectTypeStatusSchema = z.enum(['active', 'draft']).meta({ id: 'ContentObjectTypeStatus' });

/*
 * The five content-type shapes, composed from one field dictionary.
 *
 * They are five because the API publishes five: a stored type, a catalog entry, an in-code
 * definition, the create payload and the read alias. They differ in three ways that a single schema
 * cannot express — which properties they carry, what ORDER they publish them in, and whether the
 * audit fields are required — and the published order is part of the contract, so `.pick()` over one
 * base cannot produce all five.
 *
 * What can be shared is every field DEFINITION, which is what this dictionary is. Each schema below
 * then lists the keys it publishes, in the order it publishes them, and a change to a type or a
 * description lands in all five at once.
 */
const contentTypeFields = {
    id: z.string().meta({ description: 'Unique identifier for the object' }),
    name: z.string().meta({ description: 'Human-readable name or title' }),
    description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
    tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
    object_schema: z
        .looseObject({})
        .meta({
            description:
                'JSON Schema for the structured properties extracted into documents of this type. ' +
                'Only included in ContentObjectTypeItem if explicitly requested; always included in ContentObjectType.',
        })
        .optional(),
    table_layout: z
        .array(ColumnLayoutSchema)
        .meta({
            description:
                'Column layout used when listing documents of this type. ' +
                'Only included in ContentObjectTypeItem if explicitly requested; always included in ContentObjectType.',
        })
        .optional(),
    is_chunkable: z
        .boolean()
        .meta({ description: 'Whether documents of this type can be split into chunks' })
        .optional(),
    strict_mode: z
        .boolean()
        .meta({
            description:
                'Determines if the content will be validated against the object schema a generation time and save/update time.',
        })
        .optional(),
    status: ContentObjectTypeStatusSchema.optional(),
    intake: ContentTypeIntakePolicySchema.optional(),
    editing: ContentTypeEditingPolicySchema.optional(),
    /**
     * Display title, as every OTHER app-contribution shape already publishes it:
     * `InCodeViewDefinition`, `InCodeProcessDefinition` and `AppDashboardDefinition` all pair the
     * app-local `name` used for lookup with an optional human-readable `title`. A contributed type
     * was the one shape missing it, so deployed app packages sent `title` into a `strictObject` that
     * forbade it and `GET /projects/:projectId/app-types` and `GET /types/catalog` failed their own
     * response contract on every call.
     *
     * Appended last on purpose: property order decides the generated clients' constructor argument
     * order, so a new field goes on the end rather than next to `name` where it reads better.
     *
     * Note this key reaches only the two shapes that spread the whole dictionary —
     * `InCodeTypeDefinition` and `ContentObjectTypeCatalogEntry`, the two that carry app
     * contributions. The stored shapes and the create payload list their keys explicitly, so a
     * stored type still has no `title`.
     */
    title: z.string().meta({ description: 'Display title. Defaults to `name` or `id`.' }).optional(),
};

/**
 * Audit fields as a STORED type publishes them: written by the server on every save, so always
 * present and documented.
 */
const storedAuditFields = {
    updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
    created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
    created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
    updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
};

/**
 * Audit fields as the CATALOG publishes them: optional, because a catalog entry may be an in-code
 * type contributed by a plugin, which nobody created and nobody has modified. This difference is the
 * reason the catalog has its own component rather than reusing `ContentObjectTypeItem`.
 */
const catalogAuditFields = {
    updated_by: z.string().optional(),
    created_by: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
};

export const ContentObjectTypeCatalogEntrySchema = z
    .strictObject({
        ...contentTypeFields,
        ...catalogAuditFields,
        edit_revision: EditRevisionSchema.optional().meta({
            description: 'Stored-resource revision. Omitted for app-contributed in-code types.',
        }),
    })
    .meta({ id: 'ContentObjectTypeCatalogEntry' });

export const ContentObjectTypeCatalogEntryArraySchema = z
    .array(ContentObjectTypeCatalogEntrySchema)
    .meta({ id: 'ContentObjectTypeCatalogEntryArray' });

/**
 * A stored content type, in the order it is published.
 *
 * `ContentObjectTypeItem` and `ContentObjectType` are two component names for this one shape — the
 * API has always published both bodies in full. They are built from this shape rather than one from
 * the other, because `.meta({ id })` on a schema that already carries an id produces a `$ref` to the
 * first rather than a second body, which would change the published document.
 */
const storedContentTypeShape = {
    id: contentTypeFields.id,
    edit_revision: EditRevisionSchema,
    name: contentTypeFields.name,
    description: contentTypeFields.description,
    tags: contentTypeFields.tags,
    ...storedAuditFields,
    status: contentTypeFields.status,
    is_chunkable: contentTypeFields.is_chunkable,
    intake: contentTypeFields.intake,
    editing: contentTypeFields.editing,
    table_layout: contentTypeFields.table_layout,
    object_schema: contentTypeFields.object_schema,
    strict_mode: contentTypeFields.strict_mode,
};

export const ContentObjectTypeItemSchema = z.strictObject(storedContentTypeShape).meta({ id: 'ContentObjectTypeItem' });

export const ContentObjectTypeItemArraySchema = z
    .array(ContentObjectTypeItemSchema)
    .meta({ id: 'ContentObjectTypeItemArray' });

/*
 * The three shapes below were once derived from mapped types: `InCodeTypeDefinition` was published
 * as `Pick_ContentObjectTypeItem_id_name_...`, and `ContentObjectType` and
 * `CreateContentObjectTypePayload` were an `extends` and an `Omit<>` over it. A mapped type over a
 * canonical alias resolves to `{}`, so they are authored — and composed, so they cannot drift.
 */
export const InCodeTypeDefinitionSchema = z.strictObject(contentTypeFields).meta({ id: 'InCodeTypeDefinition' });

export const CreateContentObjectTypePayloadSchema = z
    .strictObject({
        status: contentTypeFields.status,
        is_chunkable: contentTypeFields.is_chunkable,
        intake: contentTypeFields.intake,
        editing: contentTypeFields.editing,
        table_layout: contentTypeFields.table_layout,
        object_schema: contentTypeFields.object_schema,
        strict_mode: contentTypeFields.strict_mode,
        name: contentTypeFields.name,
        description: contentTypeFields.description,
        tags: contentTypeFields.tags,
    })
    .meta({ id: 'CreateContentObjectTypePayload' });

/**
 * The update payload, which is the create payload with nothing required.
 *
 * `PUT /types/:typeId` published `CreateContentObjectTypePayload` — including its `required: ['name']`
 * — while every caller has always sent a single field: the type editor sends `{ object_schema }`,
 * `{ editing }` or `{ intake }`, and the `create_or_update_object_type` agent tool sends whatever the
 * model changed. Nothing enforced the document, so the disagreement was invisible; enforcing it made
 * the documented contract reject the only shape anyone sends.
 *
 * So this is a correction to the document rather than a new restriction on callers: an update names
 * the fields it changes, which is what `.partial()` says and what the handler has always done. The
 * property order is the create payload's, so the generated clients' argument order does not move.
 */
export const UpdateContentObjectTypePayloadSchema = CreateContentObjectTypePayloadSchema.partial()
    .extend({ expected_edit_revision: ExpectedEditRevisionSchema })
    .meta({
        id: 'UpdateContentObjectTypePayload',
        description:
            'Fields to change on a content object type. Only fields present are written; ' +
            'expected_edit_revision prevents overwriting a concurrent edit.',
    });

export const ContentObjectTypeSchema = z.strictObject(storedContentTypeShape).meta({ id: 'ContentObjectType' });

/**
 * The content-type listing query contracts, composed from one paging shape for the same reason the
 * type shapes above are: the four catalog routes and the stored listing share `layout`, `schema`,
 * `limit` and `offset` verbatim, and the two that drifted apart would drift silently.
 *
 * `layout` and `schema` select which of the two heavy columns come back, so they are projection
 * switches rather than filters — which is why they read as booleans on every one of these routes.
 */
const contentTypeListingFields = {
    layout: z.boolean().optional(),
    schema: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
};

export const ContentObjectTypeCatalogQuerySchema = z
    .strictObject({
        tag: z.string().optional(),
        ...contentTypeListingFields,
    })
    .meta({ id: 'ContentObjectTypeCatalogQuery' });

export const ContentObjectTypeListQuerySchema = z
    .strictObject({
        name: z.string().optional(),
        chunkable: z.boolean().optional(),
        ...contentTypeListingFields,
    })
    .meta({ id: 'ContentObjectTypeListQuery' });
