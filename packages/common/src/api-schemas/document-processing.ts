import { z } from 'zod';
import { MarkdownRenditionFormat } from '../store/store.js';
import { WorkflowExecutionStatusValues } from '../store/workflow.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

/** Zod's `.nullable()` emits `anyOf`; this annotation preserves the published type-array form. */
const nullableStringSchema: z.ZodType<string | null> = z.any().meta({ type: ['string', 'null'] });

export const WorkflowExecutionStatusSchema = z
    .enum(WorkflowExecutionStatusValues)
    .meta({ id: 'WorkflowExecutionStatus' });

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const GroundedAssistantResponseSchema = z
    .strictObject({
        agent_run_id: z.string().meta({ description: 'The AgentRun id to stream/render the conversation.' }),
        workflow_id: z.string().meta({ description: 'The conversation workflow id backing the run.' }),
        object_id: z.string().meta({ description: 'The object the assistant is scoped to.' }),
    })
    .meta({
        id: 'GroundedAssistantResponse',
        description:
            'Response from starting the interactive grounded extraction assistant. The agent run + conversation workflow are launched server-side (recordRun -> stage the document into the agent space -> launch the interactive conversation); the client renders the conversation with `agent_run_id`.',
    });

export const GroundedExtractionRequestSchema = z
    .strictObject({
        schema: z
            .looseObject({})
            .meta({ description: 'JSON schema describing the data to extract. Takes precedence over type_ref.' })
            .optional(),
        type_ref: z
            .string()
            .meta({ description: 'Content type id or catalog ref whose object_schema drives the extraction.' })
            .optional(),
        interaction_name: z
            .string()
            .meta({ description: 'Interaction to use. Defaults to sys:ExtractInformationGrounded.' })
            .optional(),
        max_pages: z.number().meta({ description: 'Maximum number of pages to process.' }).optional(),
        force_ocr: z.boolean().meta({ description: 'Run OCR on every page even when a text layer exists.' }).optional(),
        refresh_ocr: z
            .boolean()
            .meta({ description: 'Re-run OCR on pages that need it instead of restoring the stored OCR result.' })
            .optional(),
        use_vision: z
            .boolean()
            .meta({
                description:
                    'Attach clean page images for layout/semantic context; direct-vision pages also receive checkerboards.',
            })
            .optional(),
        grid_cell_pt: z
            .number()
            .meta({
                description:
                    'A1 locate-grid cell size in PDF points for vision pages (drives both the drawn grid and cell→box resolution). Smaller = finer grid / more cells. Default: 14.',
            })
            .optional(),
        raster_mode: z
            .enum(['vision', 'ocr'])
            .meta({
                description:
                    "How to read pages that have no digital text layer (scans / image-only pages). 'vision' (default): read them off the page image with the extraction model, skipping OCR entirely. 'ocr': legacy path — OCR those pages and block-ground on the (lossy) OCR text. Set to 'ocr' to revert to the pre-vision behavior.",
            })
            .optional(),
        window_pages: z
            .number()
            .meta({
                description: 'Maximum pages per extraction call; larger documents are split into sequential windows.',
            })
            .optional(),
        agentic_extraction: z
            .boolean()
            .meta({
                description:
                    'Extract with an autonomous agent (views the whole document at once) instead of the deterministic windowed pipeline. Sidesteps window-boundary splits on long documents. The workflow stages the artifacts into an agent space, runs a conversation agent that writes the extraction, then folds it back.',
            })
            .optional(),
        extract_agent: z
            .string()
            .meta({ description: 'Agent interaction for agentic_extraction. Defaults to sys:GeneralAgent.' })
            .optional(),
        update_properties: z
            .boolean()
            .meta({ description: "Update the object's properties with the extracted data. Default: true." })
            .optional(),
        config: InteractionExecutionConfigurationSchema.meta({
            description: 'LLM execution configuration (model, environment, ...) for the main pass.',
        }).optional(),
        hard_config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration used instead of `config` on hard content (scans, handwriting).',
        }).optional(),
        hardness_threshold: z
            .number()
            .meta({ description: 'Hardness score (0..1) at or above which `hard_config` is used. Default: 0.5.' })
            .optional(),
        review_config: InteractionExecutionConfigurationSchema.meta({
            description: 'Execution configuration for the post-extraction review pass. No review runs when absent.',
        }).optional(),
        review_threshold: z
            .number()
            .meta({
                description: 'Hardness score (0..1) at or above which the review runs. Defaults to hardness_threshold.',
            })
            .optional(),
        coverage_review_threshold: z
            .number()
            .meta({
                description: "Review triggers when any page's citation coverage falls below this floor. Default: 0.2.",
            })
            .optional(),
        force_review: z
            .boolean()
            .meta({
                description:
                    'Run the model review even when every citation was digitally verified. Requires review_config.',
            })
            .optional(),
        operator_instructions: z
            .string()
            .meta({
                description:
                    'Free-text operator guidance folded into the extraction prompt to steer a (re-)extraction, e.g. "part numbers are in the third column; some line items wrap onto the next row".',
            })
            .optional(),
        user_prompt: z
            .string()
            .meta({
                description:
                    "Interactive assistant only: the operator's opening message for the assistant conversation.",
            })
            .optional(),
    })
    .meta({
        id: 'GroundedExtractionRequest',
        description:
            "Request body to start a grounded extraction on a content object. All fields are optional: with none set, the object's own content-type schema drives the extraction with default models and settings.",
    });

export const GroundedVerificationBreakdownSchema = z
    .strictObject({
        total: z.number().meta({ description: 'Total number of cited values.' }),
        digitally_verified: z
            .number()
            .meta({ description: "Values matched verbatim against the document's text (digital layer or OCR)." }),
        ai_verified: z.number().meta({ description: 'Values the reviewer model confirmed against the page image.' }),
        unverified: z
            .number()
            .meta({ description: 'Values read from the image but neither text-matched nor reviewer-confirmed.' }),
    })
    .meta({
        id: 'GroundedVerificationBreakdown',
        description:
            "How each extracted value was verified. Two kinds, both trustworthy: digitally verified (matched the document's text — digital layer or OCR) and AI verified (the reviewer confirmed it against the page image — the primary signal for scanned or handwritten content, which has no text layer to match).",
    });

export const GroundedExtractionVerdictSchema = z.enum(['good_to_go', 'needs_review']).meta({
    id: 'GroundedExtractionVerdict',
    description:
        'Document-level trust verdict for a grounded extraction. `good_to_go` means the extracted content (after any review corrections) can be used without a human check; `needs_review` means a human should verify it. This reflects content correctness, not how many citation boxes rendered.',
});

export const DocProcessorOutputFormatSchema = z
    .literal('markdown')
    .meta({ id: 'DocProcessorOutputFormat', description: 'Output format for document processing workflows' });

export const DocAnalyzerProgressStatusSchema = z
    .strictObject({
        total: z.number(),
        processed: z.number(),
        success: z.number(),
        failed: z.number(),
    })
    .meta({ id: 'DocAnalyzerProgressStatus' });

export const DocumentProcessingPhaseSchema = z
    .enum(['markdown', 'grounded_extraction'])
    .meta({ id: 'DocumentProcessingPhase' });

export const DocumentPrepOptionsSchema = z
    .object({
        features: z.array(z.string()).optional(),
        debug: z.boolean().optional(),
        output_format: DocProcessorOutputFormatSchema.optional(),
    })
    .catchall(z.unknown())
    .meta({ id: 'DocumentPrepOptions' });

export const GroundedExtractionResultResponseSchema = z
    .strictObject({
        object_id: z.string(),
        data: z.looseObject({}).meta({ description: 'The extracted data, shaped by the requested schema.' }),
        verdict: GroundedExtractionVerdictSchema.meta({ description: 'Document-level trust verdict.' }).optional(),
        verdict_reason: z.string().meta({ description: 'One-sentence rationale for the verdict.' }).optional(),
        confidence: z.number().meta({ description: 'Mean citation confidence in [0,1].' }).optional(),
        verification: GroundedVerificationBreakdownSchema.meta({ description: 'Per-value verification breakdown.' }),
        review: z
            .strictObject({
                assessment: z.enum(['complete', 'issues_found']),
                summary: z.string().optional(),
                corrections_applied: z.number().optional(),
            })
            .meta({ description: 'Review outcome, when a review pass ran.' })
            .optional(),
        result_url: nullableStringSchema
            .meta({
                description: 'Signed download URL for the full grounded-extraction.json (data + citations + boxes).',
            })
            .optional(),
    })
    .meta({
        id: 'GroundedExtractionResultResponse',
        description:
            'Completed grounded extraction result: the extracted data with its trust verdict and verification breakdown, plus a download URL for the full citations artifact.',
    });

export const DocAnalyzerProgressSchema = z
    .strictObject({
        phase: DocumentProcessingPhaseSchema.optional(),
        pages: DocAnalyzerProgressStatusSchema,
        images: DocAnalyzerProgressStatusSchema,
        tables: DocAnalyzerProgressStatusSchema,
        visuals: DocAnalyzerProgressStatusSchema,
        started_at: z.number().optional(),
        percent: z.number(),
        output_format: DocProcessorOutputFormatSchema.meta({
            description: 'The output format being used for processing.',
        }).optional(),
    })
    .meta({ id: 'DocAnalyzerProgress' });

export const DocAnalyzeRunStatusResponseSchema = z
    .strictObject({
        workflow_id: nullableStringSchema,
        workflow_run_id: nullableStringSchema,
        status: WorkflowExecutionStatusSchema,
        phase: DocumentProcessingPhaseSchema.optional(),
        progress: DocAnalyzerProgressSchema.optional(),
        output_format: DocProcessorOutputFormatSchema.meta({
            description: 'The output format being used for processing.',
        }).optional(),
    })
    .meta({ id: 'DocAnalyzeRunStatusResponse', description: 'Represents a document analysis run status' });

export const MarkdownRenditionFormatSchema = z.enum(MarkdownRenditionFormat).meta({ id: 'MarkdownRenditionFormat' });

export const PdfRenderingMetadataSchema = z
    .strictObject({
        document_id: z.string().meta({ description: 'Document ID to display in footer' }).optional(),
        agent_name: z.string().meta({ description: 'Agent name that generated the document' }).optional(),
        agent_run_id: z.string().meta({ description: 'Agent run ID to display in footer' }).optional(),
        subtitle: z.string().meta({ description: 'Document subtitle' }).optional(),
        author: z.array(z.string()).meta({ description: 'Document author(s)' }).optional(),
        date: z
            .string()
            .meta({ description: 'Document date (displayed in header and title page; defaults to today if omitted)' })
            .optional(),
    })
    .meta({ id: 'PdfRenderingMetadata', description: 'Metadata for PDF rendering (displayed in header/footer)' });

export const RenderMarkdownPayloadSchema = z
    .strictObject({
        format: MarkdownRenditionFormatSchema.meta({ description: 'Output format' }),
        object_id: z.string().meta({ description: 'Object ID to render (mutually exclusive with content)' }).optional(),
        content: z
            .string()
            .meta({ description: 'Inline markdown content to render (mutually exclusive with object_id)' })
            .optional(),
        title: z
            .string()
            .meta({ description: 'Document title (used for filename when using inline content)' })
            .optional(),
        template_url: z
            .string()
            .meta({ description: 'URL to a template file for pandoc (DOCX reference doc or LaTeX template)' })
            .optional(),
        template_logo_url: z
            .string()
            .meta({ description: 'Optional logo URL for template variable `logo-path` (studio-hosted URL)' })
            .optional(),
        template_path: z
            .string()
            .meta({ description: 'Template file via artifact:/store: protocol (takes precedence over template_url)' })
            .optional(),
        logo_path: z
            .string()
            .meta({ description: 'Logo file via artifact:/store: protocol (takes precedence over template_logo_url)' })
            .optional(),
        use_default_template: z
            .boolean()
            .meta({ description: 'Use Vertesia default template if no template_url provided (default: true for pdf)' })
            .optional(),
        pandoc_options: z.array(z.string()).meta({ description: 'Additional pandoc command-line options' }).optional(),
        artifact_run_id: z.string().meta({ description: 'Run ID for resolving artifact: and image: URLs' }).optional(),
        metadata: PdfRenderingMetadataSchema.meta({
            description: 'Document metadata for PDF footer/header',
        }).optional(),
        template_data_source: z
            .string()
            .meta({
                description:
                    'Source reference for auto-wired template data: `store:<objectId>` or `artifact:<path-to-json>`',
            })
            .optional(),
        output_path: z.string().meta({ description: 'Custom upload path for the rendered output' }).optional(),
    })
    .meta({
        id: 'RenderMarkdownPayload',
        description: 'Payload for rendering markdown to PDF or DOCX. Either object_id OR content must be provided.',
    });

export const RenderMarkdownStartResponseSchema = z
    .strictObject({
        workflow_id: nullableStringSchema,
        workflow_run_id: nullableStringSchema,
        status: WorkflowExecutionStatusSchema,
        format: MarkdownRenditionFormatSchema.meta({ description: 'Requested output format' }),
    })
    .meta({
        id: 'RenderMarkdownStartResponse',
        description:
            'Initial response when starting a markdown rendering workflow. Clients should poll status using workflow_id/workflow_run_id.',
    });

export const RenderMarkdownStatusResponseSchema = z
    .strictObject({
        workflow_id: nullableStringSchema,
        workflow_run_id: nullableStringSchema,
        status: WorkflowExecutionStatusSchema,
        format: MarkdownRenditionFormatSchema.meta({ description: 'Requested output format (if known)' }).optional(),
        download_url: z.string().meta({ description: 'Download URL for completed output' }).optional(),
        file_uri: z.string().meta({ description: 'File URI in storage for completed output' }).optional(),
        error: z.string().meta({ description: 'Error details for failed/terminated runs' }).optional(),
    })
    .meta({
        id: 'RenderMarkdownStatusResponse',
        description: 'Polled status response for markdown rendering workflow.',
    });

/** Query components validate declared fields without rejecting unrelated query parameters. */
export const RenderMarkdownStatusQuerySchema = z.looseObject({
    workflow_id: z.string(),
    workflow_run_id: z.string(),
});
