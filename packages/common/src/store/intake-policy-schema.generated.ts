// GENERATED FILE — DO NOT EDIT.
//
// Written by `scripts/gen-intake-policy-schema.ts` from `ContentTypeIntakePolicySchema` in
// `../api-schemas/store.ts`, through the same adapter that emits the OpenAPI components. Edit the Zod
// schema and re-run `pnpm run gen:schemas`; `store.contract.test.ts` fails if this drifts from the
// canonical component, and fails too if it accepts a value the Zod schema rejects.
//
// It exists so the Studio policy editors and the server validators get a self-contained JSON
// Schema without importing Zod: the package root exports plain data, and `zod` stays out of every
// browser bundle. The component's `$ref`s are re-rooted from `#/components/schemas/` to `#/$defs/`
// so AJV and Monaco can compile it standalone.
//
// It carries the name consumers have always imported. The Zod object it was emitted from is exported
// under the same name from `../api-schemas/store.ts`, which the package root does NOT re-export —
// that split is what keeps zod out of the browser while the alias-provenance gate still sees the
// `${Name}Schema` convention it requires.

import type { JSONObject } from '../json.js';

export const ContentTypeIntakePolicySchema: JSONObject = {
    type: 'object',
    properties: {
        mode: {
            type: 'string',
            enum: ['programmatic', 'agentic'],
            description: 'Intake orchestration mode for this type.',
        },
        identification: {
            type: 'object',
            properties: {
                guidance: {
                    type: 'string',
                },
                distinguish_from: {
                    type: 'string',
                },
                examples: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
            additionalProperties: false,
            description: 'Guidance used when selecting or creating this content type.',
        },
        locate: {
            type: 'object',
            properties: {
                instructions: {
                    type: 'string',
                    description: 'What to look for ("commercial terms, payment schedule, signature pages").',
                },
                detail: {
                    type: 'number',
                    enum: [8, 16],
                    description: 'Pages per contact sheet: 8 = bigger tiles (headings readable). Default 16.',
                },
                min_pages: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 2147483647,
                    description: 'Only run when the page count is at least this. Default 8.',
                },
            },
            required: ['instructions'],
            additionalProperties: false,
            description:
                'Document-map ("locate") pass: page thumbnails tiled into labeled contact sheets, one vision call returns which pages matter for THIS type. The result can scope conversion and extraction, and doubles as the vision planner for visual extraction.',
        },
        text_conversion: {
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                },
                method: {
                    type: 'string',
                    enum: ['auto', 'basic', 'llm', 'custom'],
                },
                custom: {
                    type: 'object',
                    properties: {
                        interaction: {
                            type: 'string',
                        },
                        agent: {
                            type: 'string',
                        },
                    },
                    additionalProperties: false,
                },
                instructions: {
                    type: 'string',
                },
                output_format: {
                    type: 'string',
                    enum: ['markdown', 'text'],
                },
                scope: {
                    $ref: '#/$defs/IntakePageScope',
                    description: 'Which pages to convert: everything or the locate result. Default all.',
                },
                page_ranges: {
                    $ref: '#/$defs/IntakePageRanges',
                    description: 'Static page ranges to convert (wins over `scope` when set).',
                },
                render_dpi: {
                    type: 'integer',
                    minimum: 72,
                    maximum: 2147483647,
                    description:
                        'DPI at which each page is rendered to the image the LLM converts. Default 150 — the accuracy/cost sweet spot: higher resolutions balloon input tokens (some providers tile the page) for no quality gain, below ~150 dense tables start to misread. Raise only for very fine print.',
                },
                config: {
                    $ref: '#/$defs/InteractionExecutionConfiguration',
                    description:
                        "Model execution config for the page-conversion interaction (method 'llm'/'auto' -> sys:ConvertPageToMarkdown, method 'custom' -> the custom interaction). Lets the visual conversion run on a cheaper/faster model (e.g. a flash model) than extraction. When unset, conversion uses the run's model config or the project default model.",
                },
            },
            additionalProperties: false,
            description: 'Controls source-to-text conversion before extraction and embedding.',
        },
        extraction: {
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                },
                source: {
                    type: 'string',
                    enum: ['auto', 'text', 'vision', 'mixed'],
                },
                instructions: {
                    type: 'string',
                },
                interaction: {
                    type: 'string',
                },
                config: {
                    $ref: '#/$defs/InteractionExecutionConfiguration',
                    description:
                        "Model execution config for the standard property-extraction interaction (sys:ExtractInformation). Lets extraction run on a different model/environment than the visual page conversion. When unset, extraction uses the run's model config or the project default model. (Grounded extraction is configured separately via grounding.config.)",
                },
                scope: {
                    $ref: '#/$defs/IntakePageScope',
                    description: 'Which pages extraction sees: everything or the locate result.',
                },
                page_ranges: {
                    $ref: '#/$defs/IntakePageRanges',
                    description: 'Static page ranges extraction sees (wins over `scope` when set).',
                },
                max_pages: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 2147483647,
                    description: 'Cap on pages sent to extraction. Default 20.',
                },
                vision: {
                    type: 'object',
                    properties: {
                        default_detail: {
                            $ref: '#/$defs/IntakeVisionDetail',
                        },
                        allowed_details: {
                            type: 'array',
                            items: {
                                $ref: '#/$defs/IntakeVisionDetail',
                            },
                        },
                        max_image_tokens: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 2147483647,
                            description: 'PRIMARY budget: estimated image tokens per extraction call. Default 16000.',
                        },
                        max_payload_mb: {
                            type: 'number',
                            minimum: 1,
                            description: 'Transport guard in megabytes. Default 16.',
                        },
                        max_pages_per_call: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 2147483647,
                            description: 'Cap on page images per extraction call. Default 8.',
                        },
                    },
                    additionalProperties: false,
                    description:
                        'Vision evidence budget for visual extraction. Detail names reference platform profiles; the type never defines dpi/quality/resolution.',
                },
                verification: {
                    type: 'object',
                    properties: {
                        enabled: {
                            type: 'boolean',
                        },
                        model: {
                            type: 'string',
                        },
                        environment: {
                            type: 'string',
                        },
                        materiality: {
                            type: 'string',
                        },
                        threshold: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                        },
                        max_retries: {
                            type: 'integer',
                            minimum: 0,
                            maximum: 2147483647,
                        },
                        on_fail: {
                            type: 'string',
                            enum: ['flag', 'block'],
                        },
                    },
                    additionalProperties: false,
                },
                grounding: {
                    $ref: '#/$defs/ContentTypeExtractionGroundingPolicy',
                    description: 'Controls PDF block-level citation grounding with annotated proof output.',
                },
            },
            additionalProperties: false,
            description: 'Controls schema-property extraction after type assignment.',
        },
        rendering_template: {
            type: 'string',
            description: 'Handlebars template used to materialize extracted properties into object text.',
        },
        embeddings: {
            $ref: '#/$defs/EmbeddingTypeEnabledMap',
            description: 'Per-type embedding switches. Unspecified values inherit the project policy.',
        },
        generate_toc: {
            type: 'boolean',
            description: 'Whether intake should generate a table of contents for matching documents.',
        },
        default_view: {
            type: 'string',
            enum: ['auto', 'text', 'pdf', 'image', 'properties'],
            description: 'Preferred first view for objects of this type.',
        },
    },
    additionalProperties: false,
    description: 'Per-content-type policy for the standard intake workflows.',
    $defs: {
        AzureFoundryChatOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'azure-foundry-chat',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                seed: {
                    type: 'number',
                },
                image_detail: {
                    type: 'string',
                    enum: ['low', 'high', 'auto'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockAI21Options: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-ai21',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockClaudeOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-claude',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                top_k: {
                    type: 'number',
                },
                thinking_budget_tokens: {
                    type: 'number',
                },
                include_thoughts: {
                    type: 'boolean',
                },
                effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'xhigh', 'max'],
                },
                cache_enabled: {
                    type: 'boolean',
                },
                cache_ttl: {
                    type: 'string',
                    enum: ['5m', '1h'],
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockCohereCommandOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-cohere-command',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockConverseOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-converse',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockGptOssOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-gpt-oss',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                reasoning_effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                frequency_penalty: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockMantleChatCompletionsOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-mantle-chat-completions',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                reasoning_effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockMantleClaudeOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-mantle-claude',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                top_k: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'xhigh', 'max'],
                },
                thinking_budget_tokens: {
                    type: 'number',
                },
                include_thoughts: {
                    type: 'boolean',
                },
                cache_enabled: {
                    type: 'boolean',
                },
                cache_ttl: {
                    type: 'string',
                    enum: ['5m', '1h'],
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockMantleResponsesOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-mantle-responses',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                effort: {
                    type: 'string',
                    enum: ['none', 'low', 'medium', 'high', 'xhigh'],
                },
                reasoning_effort: {
                    type: 'string',
                    enum: ['none', 'low', 'medium', 'high', 'xhigh'],
                },
                verbosity: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                image_detail: {
                    type: 'string',
                    enum: ['low', 'high', 'auto'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockMistralOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-mistral',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockNovaOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-nova',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        BedrockPalmyraOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-palmyra',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                min_tokens: {
                    type: 'number',
                },
                seed: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        ConfigModes: {
            type: 'string',
            enum: ['RUN_AND_INTERACTION_CONFIG', 'RUN_CONFIG_ONLY', 'INTERACTION_CONFIG_ONLY'],
        },
        ContentTypeExtractionGroundingPolicy: {
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Enable PDF block-level citation grounding for property extraction.',
                },
                interaction: {
                    type: 'string',
                    description: 'Grounded extraction interaction. Defaults to the system grounded extractor.',
                },
                max_pages: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 2147483647,
                    description: 'Maximum pages to process.',
                },
                force_ocr: {
                    type: 'boolean',
                    description: 'Run OCR on every page even when a text layer exists.',
                },
                use_vision: {
                    type: 'boolean',
                    description: 'Attach instrumented page images to the grounded extraction prompt.',
                },
                raster_mode: {
                    type: 'string',
                    enum: ['vision', 'ocr'],
                    description:
                        "How to read pages with no digital text layer (scans / image-only pages). 'vision' (default): read them off the page image and skip OCR. 'ocr': legacy path — OCR those pages and block-ground on the (lossy) OCR text.",
                },
                grid_cell_pt: {
                    type: 'number',
                    minimum: 1,
                    description:
                        'A1 locate-grid cell size in PDF points for vision pages. Smaller = finer grid (more cells, tighter boxes) but can trip weaker models into over-reading; tune per the model in `config`. Default 15.',
                },
                omit_block_boxes: {
                    type: 'boolean',
                    description:
                        'Drop block bounding boxes from the extraction prompt. Only sound with use_vision (layout comes from the image).',
                },
                window_pages: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 2147483647,
                    description: 'Maximum pages per grounded extraction call before windowing.',
                },
                update_properties: {
                    type: 'boolean',
                    description: 'Update object properties with grounded extraction data. Default true.',
                },
                config: {
                    $ref: '#/$defs/InteractionExecutionConfiguration',
                    description: 'Model execution configuration for the main grounded extraction interaction.',
                },
                hard_config: {
                    $ref: '#/$defs/InteractionExecutionConfiguration',
                    description: 'Model execution configuration used for hard-to-read content.',
                },
                hardness_threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Hardness score at or above which hard_config is used. Default 0.5.',
                },
                min_citation_density: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description:
                        'Minimum citations-per-leaf-value ratio; completions below it retry with escalation. Default 0.3.',
                },
                refresh_ocr: {
                    type: 'boolean',
                    description: 'Re-run OCR instead of restoring durable OCR artifacts (stale pipeline output).',
                },
                review: {
                    $ref: '#/$defs/ContentTypeExtractionGroundingReviewPolicy',
                    description: 'Optional post-extraction review pass.',
                },
            },
            additionalProperties: false,
        },
        ContentTypeExtractionGroundingReviewPolicy: {
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                    description: 'Set false to disable an inherited grounding review pass for this type.',
                },
                config: {
                    $ref: '#/$defs/InteractionExecutionConfiguration',
                    description: 'Model execution configuration for the review interaction.',
                },
                threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Hardness score at or above which review runs. Defaults to hardness_threshold.',
                },
                coverage_threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description:
                        "Review also runs when any page's citation coverage falls below this floor (evidence of missed content). Default 0.2.",
                },
                force: {
                    type: 'boolean',
                    description: 'Run review regardless of hardness.',
                },
            },
            additionalProperties: false,
        },
        EmbeddingTypeEnabledMap: {
            type: 'object',
            properties: {
                text: {
                    type: 'boolean',
                },
                image: {
                    type: 'boolean',
                },
                properties: {
                    type: 'boolean',
                },
            },
            additionalProperties: false,
        },
        GroqOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'groq-deepseek-thinking',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                reasoning_format: {
                    type: 'string',
                    enum: ['parsed', 'raw', 'hidden'],
                },
            },
            required: ['_option_id', 'reasoning_format'],
            additionalProperties: false,
        },
        HttpTimeoutOptions: {
            type: 'object',
            properties: {
                headersTimeout: {
                    type: 'number',
                    description: 'Time (ms) to wait for the first response byte after the request is sent.',
                },
                bodyTimeout: {
                    type: 'number',
                    description: 'Time (ms) between body chunks once streaming has started.',
                },
                connectTimeout: {
                    type: 'number',
                    description: 'TCP/TLS connect timeout (ms).',
                },
                keepAliveTimeout: {
                    type: 'number',
                    description: 'Idle socket reuse timeout (ms).',
                },
            },
            additionalProperties: false,
            description:
                "HTTP timeouts applied to a driver's upstream LLM-provider calls.\n\nAll values are in milliseconds. Drivers should map these onto whatever HTTP client their SDK uses; the defaults applied in `@llumiverse/core/createDriverHttpAgent` are:   - headersTimeout:   900_000   - bodyTimeout:      900_000   - connectTimeout:   60_000   - keepAliveTimeout: 300_000\n\nThe response defaults are deliberately longer than the hosting request boundary. Application-level cancellation should end user work first; driver timeouts are bounded-resource safety nets.",
        },
        ImagenMaskMode: {
            type: 'string',
            enum: ['MASK_MODE_USER_PROVIDED', 'MASK_MODE_BACKGROUND', 'MASK_MODE_FOREGROUND', 'MASK_MODE_SEMANTIC'],
        },
        ImagenOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'vertexai-imagen',
                },
                number_of_images: {
                    type: 'number',
                },
                seed: {
                    type: 'number',
                },
                person_generation: {
                    type: 'string',
                    enum: ['dont_allow', 'allow_adults', 'allow_all'],
                },
                safety_setting: {
                    type: 'string',
                    enum: ['block_none', 'block_only_high', 'block_medium_and_above', 'block_low_and_above'],
                },
                image_file_type: {
                    type: 'string',
                    enum: ['image/jpeg', 'image/png'],
                },
                jpeg_compression_quality: {
                    type: 'number',
                },
                aspect_ratio: {
                    type: 'string',
                    enum: ['1:1', '4:3', '3:4', '16:9', '9:16'],
                },
                add_watermark: {
                    type: 'boolean',
                },
                enhance_prompt: {
                    type: 'boolean',
                },
                edit_mode: {
                    $ref: '#/$defs/ImagenTaskType',
                },
                guidance_scale: {
                    type: 'number',
                },
                edit_steps: {
                    type: 'number',
                },
                mask_mode: {
                    $ref: '#/$defs/ImagenMaskMode',
                },
                mask_dilation: {
                    type: 'number',
                },
                mask_class: {
                    type: 'array',
                    items: {
                        type: 'number',
                    },
                },
                controlType: {
                    type: 'string',
                    enum: ['CONTROL_TYPE_FACE_MESH', 'CONTROL_TYPE_CANNY', 'CONTROL_TYPE_SCRIBBLE'],
                },
                controlImageComputation: {
                    type: 'boolean',
                },
                subjectType: {
                    type: 'string',
                    enum: [
                        'SUBJECT_TYPE_PERSON',
                        'SUBJECT_TYPE_ANIMAL',
                        'SUBJECT_TYPE_PRODUCT',
                        'SUBJECT_TYPE_DEFAULT',
                    ],
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        ImagenTaskType: {
            type: 'string',
            enum: [
                'TEXT_IMAGE',
                'EDIT_MODE_INPAINT_REMOVAL',
                'EDIT_MODE_INPAINT_INSERTION',
                'EDIT_MODE_BGSWAP',
                'EDIT_MODE_OUTPAINT',
                'CUSTOMIZATION_SUBJECT',
                'CUSTOMIZATION_STYLE',
                'CUSTOMIZATION_CONTROLLED',
                'CUSTOMIZATION_INSTRUCT',
            ],
        },
        IntakePageRanges: {
            type: 'array',
            items: {
                minItems: 2,
                maxItems: 2,
                type: 'array',
                items: {
                    type: 'integer',
                    minimum: -2147483648,
                    maximum: 2147483647,
                },
            },
            description:
                'Static page ranges: inclusive [start, end] pairs; negative indexes count from the end of the document ([[1, 2], [-1, -1]] = first two pages plus the last page).',
        },
        IntakePageScope: {
            type: 'string',
            enum: ['all', 'located'],
            description:
                'Named page scope for intake conversion/extraction: everything or the locate-pass result. Static page ranges live in the sibling `page_ranges` field (which wins when set) — kept as a SEPARATE field because scalar-or-collection unions generate unstable API clients.',
        },
        IntakeVisionDetail: {
            type: 'string',
            enum: ['low', 'standard', 'high'],
            description:
                'Vision detail level names referenced by intake policies. The rendering profiles behind the names (dpi, max size, quality, color mode) are PLATFORM-defined and project-overridable — a type only ever references a detail name.',
        },
        InteractionExecutionConfiguration: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                },
                environment: {
                    type: 'string',
                },
                model: {
                    type: 'string',
                },
                do_validate: {
                    type: 'boolean',
                },
                run_data: {
                    $ref: '#/$defs/RunDataStorageLevel',
                },
                configMode: {
                    $ref: '#/$defs/ConfigModes',
                },
                model_options: {
                    $ref: '#/$defs/ModelOptions',
                },
                prompt_cache_key: {
                    type: 'string',
                    description: 'Stable provider-side routing key for automatic prompt caching.',
                },
                prompt_cache_mode: {
                    $ref: '#/$defs/PromptCacheMode',
                    description:
                        'Controls provider-side explicit caching: auto falls back safely, off disables it, and required surfaces cache preparation failures for diagnostics.',
                },
                prompt_cache_ttl_seconds: {
                    type: 'integer',
                    minimum: 60,
                    maximum: 9007199254740991,
                    description:
                        'Caller-selected explicit cache lifetime in seconds. Defaults remain provider-specific; Vertex Gemini requires at least 60 seconds.',
                },
                prompt_cache_schema_suffix: {
                    type: 'boolean',
                    description:
                        'Put the result schema after the cached prefix; Vertesia still validates the returned JSON against it.',
                },
                http_timeout: {
                    $ref: '#/$defs/HttpTimeoutOptions',
                    description: 'Per-run HTTP timeouts for upstream LLM-provider calls.',
                },
            },
            additionalProperties: false,
        },
        MistralTextOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'mistral-text',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                effort: {
                    type: 'string',
                    enum: ['none', 'high'],
                },
                random_seed: {
                    type: 'integer',
                    minimum: -9007199254740991,
                    maximum: 9007199254740991,
                },
                safe_prompt: {
                    type: 'boolean',
                },
                parallel_tool_calls: {
                    type: 'boolean',
                },
                tool_choice: {
                    type: 'string',
                    enum: ['auto', 'none', 'any', 'required'],
                },
                prompt_mode: {
                    type: 'string',
                    const: 'reasoning',
                },
                include_thoughts: {
                    type: 'boolean',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        ModelOptions: {
            oneOf: [
                {
                    $ref: '#/$defs/TextFallbackOptions',
                },
                {
                    $ref: '#/$defs/AzureFoundryChatOptions',
                },
                {
                    $ref: '#/$defs/ImagenOptions',
                },
                {
                    $ref: '#/$defs/VertexAIClaudeOptions',
                },
                {
                    $ref: '#/$defs/VertexAIGeminiOptions',
                },
                {
                    $ref: '#/$defs/VertexAIGeminiOmniVideoOptions',
                },
                {
                    $ref: '#/$defs/VertexAIGrokOptions',
                },
                {
                    $ref: '#/$defs/NovaCanvasOptions',
                },
                {
                    $ref: '#/$defs/BedrockConverseOptions',
                },
                {
                    $ref: '#/$defs/BedrockNovaOptions',
                },
                {
                    $ref: '#/$defs/BedrockMistralOptions',
                },
                {
                    $ref: '#/$defs/BedrockAI21Options',
                },
                {
                    $ref: '#/$defs/BedrockCohereCommandOptions',
                },
                {
                    $ref: '#/$defs/BedrockClaudeOptions',
                },
                {
                    $ref: '#/$defs/BedrockPalmyraOptions',
                },
                {
                    $ref: '#/$defs/BedrockGptOssOptions',
                },
                {
                    $ref: '#/$defs/TwelvelabsPegasusOptions',
                },
                {
                    $ref: '#/$defs/BedrockMantleResponsesOptions',
                },
                {
                    $ref: '#/$defs/BedrockMantleChatCompletionsOptions',
                },
                {
                    $ref: '#/$defs/BedrockMantleClaudeOptions',
                },
                {
                    $ref: '#/$defs/OpenAiThinkingOptions',
                },
                {
                    $ref: '#/$defs/OpenAiTextOptions',
                },
                {
                    $ref: '#/$defs/OpenRouterTextOptions',
                },
                {
                    $ref: '#/$defs/OpenAiDalleOptions',
                },
                {
                    $ref: '#/$defs/OpenAiGptImageOptions',
                },
                {
                    $ref: '#/$defs/XAIGrokImageOptions',
                },
                {
                    $ref: '#/$defs/GroqOptions',
                },
                {
                    $ref: '#/$defs/MistralTextOptions',
                },
            ],
        },
        NovaCanvasOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-nova-canvas',
                },
                taskType: {
                    type: 'string',
                    enum: [
                        'TEXT_IMAGE',
                        'TEXT_IMAGE_WITH_IMAGE_CONDITIONING',
                        'COLOR_GUIDED_GENERATION',
                        'IMAGE_VARIATION',
                        'INPAINTING',
                        'OUTPAINTING',
                        'BACKGROUND_REMOVAL',
                    ],
                },
                width: {
                    type: 'number',
                },
                height: {
                    type: 'number',
                },
                quality: {
                    type: 'string',
                    enum: ['standard', 'premium'],
                },
                cfgScale: {
                    type: 'number',
                },
                seed: {
                    type: 'number',
                },
                numberOfImages: {
                    type: 'number',
                },
                controlMode: {
                    type: 'string',
                    enum: ['CANNY_EDGE', 'SEGMENTATION'],
                },
                controlStrength: {
                    type: 'number',
                },
                colors: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                similarityStrength: {
                    type: 'number',
                },
                outPaintingMode: {
                    type: 'string',
                    enum: ['DEFAULT', 'PRECISE'],
                },
            },
            required: ['_option_id', 'taskType'],
            additionalProperties: false,
        },
        OpenAiDalleOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'openai-dalle',
                },
                size: {
                    type: 'string',
                    enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
                },
                image_quality: {
                    type: 'string',
                    enum: ['standard', 'hd'],
                },
                style: {
                    type: 'string',
                    enum: ['vivid', 'natural'],
                },
                response_format: {
                    type: 'string',
                    enum: ['url', 'b64_json'],
                },
                n: {
                    type: 'number',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        OpenAiGptImageOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'openai-gpt-image',
                },
                size: {
                    type: 'string',
                    enum: ['1024x1024', '1024x1536', '1536x1024', 'auto'],
                },
                image_quality: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'auto'],
                },
                background: {
                    type: 'string',
                    enum: ['transparent', 'opaque', 'auto'],
                },
                output_format: {
                    type: 'string',
                    enum: ['png', 'webp', 'jpeg'],
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        OpenAiTextOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'openai-text',
                },
                max_tokens: {
                    type: 'number',
                },
                tool_choice: {
                    type: 'string',
                    enum: ['auto', 'none', 'any', 'required'],
                },
                effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                reasoning_effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                image_detail: {
                    type: 'string',
                    enum: ['low', 'high', 'auto'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
                extra_body: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Additional provider-specific fields merged into the OpenAI-compatible request body.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        OpenAiThinkingOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'openai-thinking',
                },
                max_tokens: {
                    type: 'number',
                },
                tool_choice: {
                    type: 'string',
                    enum: ['auto', 'none', 'any', 'required'],
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                reasoning_effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                image_detail: {
                    type: 'string',
                    enum: ['low', 'high', 'auto'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
                extra_body: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Additional provider-specific fields merged into the OpenAI-compatible request body.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        OpenRouterTextOptions: {
            type: 'object',
            properties: {
                max_tokens: {
                    type: 'number',
                },
                tool_choice: {
                    type: 'string',
                    enum: ['auto', 'none', 'any', 'required'],
                },
                effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                reasoning_effort: {
                    $ref: '#/$defs/ReasoningEffort',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                image_detail: {
                    type: 'string',
                    enum: ['low', 'high', 'auto'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
                _option_id: {
                    type: 'string',
                    const: 'openrouter-text',
                },
                provider_sort: {
                    type: 'string',
                    enum: ['price', 'throughput', 'latency', 'exacto'],
                },
                provider_order: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                provider_only: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                provider_ignore: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                provider_allow_fallbacks: {
                    type: 'boolean',
                },
                provider_require_parameters: {
                    type: 'boolean',
                },
                provider_data_collection: {
                    type: 'string',
                    enum: ['allow', 'deny'],
                },
                provider_zdr: {
                    type: 'boolean',
                },
                provider_quantizations: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: [
                            'int4',
                            'int8',
                            'fp4',
                            'mxfp4',
                            'nvfp4',
                            'fp6',
                            'fp8',
                            'mxfp8',
                            'fp16',
                            'bf16',
                            'fp32',
                            'unknown',
                        ],
                    },
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        PromptCacheMode: {
            type: 'string',
            enum: ['auto', 'off', 'required'],
        },
        ReasoningEffort: {
            type: 'string',
            enum: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
        },
        RunDataStorageLevel: {
            type: 'string',
            enum: ['STANDARD', 'RESTRICTED', 'DEBUG'],
        },
        TextFallbackOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'text-fallback',
                },
                max_tokens: {
                    type: 'number',
                },
                tool_choice: {
                    type: 'string',
                    enum: ['auto', 'none', 'any', 'required'],
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                top_k: {
                    type: 'number',
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                include_thoughts: {
                    type: 'boolean',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        ThinkingLevel: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'LOW', 'MINIMAL', 'THINKING_LEVEL_UNSPECIFIED'],
        },
        TwelvelabsPegasusOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'bedrock-twelvelabs-pegasus',
                },
                temperature: {
                    type: 'number',
                },
                max_tokens: {
                    type: 'number',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        VertexAIClaudeOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'vertexai-claude',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                top_k: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                effort: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'xhigh', 'max'],
                },
                thinking_budget_tokens: {
                    type: 'number',
                },
                include_thoughts: {
                    type: 'boolean',
                },
                cache_enabled: {
                    type: 'boolean',
                },
                cache_ttl: {
                    type: 'string',
                    enum: ['5m', '1h'],
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        VertexAIGeminiOmniVideoOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'vertexai-gemini-omni-video',
                },
                task: {
                    type: 'string',
                    enum: ['text_to_video', 'image_to_video', 'reference_to_video'],
                },
                aspect_ratio: {
                    type: 'string',
                    enum: ['16:9', '9:16'],
                },
                duration_seconds: {
                    type: 'integer',
                    minimum: 3,
                    maximum: 10,
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        VertexAIGeminiOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'vertexai-gemini',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                top_k: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                presence_penalty: {
                    type: 'number',
                },
                frequency_penalty: {
                    type: 'number',
                },
                seed: {
                    type: 'number',
                },
                effort: {
                    type: 'string',
                    enum: ['minimal', 'low', 'medium', 'high'],
                },
                include_thoughts: {
                    type: 'boolean',
                },
                thinking_budget_tokens: {
                    type: 'number',
                },
                thinking_level: {
                    $ref: '#/$defs/ThinkingLevel',
                },
                service_tier: {
                    type: 'string',
                    minLength: 1,
                    description:
                        'Provider-defined processing tier. Unknown non-empty values are preserved for forward compatibility.',
                },
                flex: {
                    type: 'boolean',
                    deprecated: true,
                    'x-deprecated-message': 'Use service_tier="flex" instead.',
                    description: 'Deprecated: Use service_tier="flex" instead.',
                },
                image_aspect_ratio: {
                    type: 'string',
                    enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'],
                },
                image_size: {
                    type: 'string',
                    enum: ['1K', '2K', '4K'],
                },
                person_generation: {
                    type: 'string',
                    enum: ['ALLOW_ALL', 'ALLOW_ADULT', 'ALLOW_NONE'],
                },
                prominent_people: {
                    type: 'string',
                    enum: ['PROMINENT_PEOPLE_UNSPECIFIED', 'ALLOW_PROMINENT_PEOPLE', 'BLOCK_PROMINENT_PEOPLE'],
                },
                output_mime_type: {
                    type: 'string',
                    enum: ['image/png', 'image/jpeg'],
                },
                output_compression_quality: {
                    type: 'number',
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        VertexAIGrokOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'vertexai-grok',
                },
                max_tokens: {
                    type: 'number',
                },
                temperature: {
                    type: 'number',
                },
                top_p: {
                    type: 'number',
                },
                stop_sequence: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
        XAIGrokImageOptions: {
            type: 'object',
            properties: {
                _option_id: {
                    type: 'string',
                    const: 'xai-grok-image',
                },
                aspect_ratio: {
                    type: 'string',
                    enum: [
                        '1:1',
                        '16:9',
                        '9:16',
                        '4:3',
                        '3:4',
                        '3:2',
                        '2:3',
                        '2:1',
                        '1:2',
                        '19.5:9',
                        '9:19.5',
                        '20:9',
                        '9:20',
                        'auto',
                    ],
                },
                resolution: {
                    type: 'string',
                    enum: ['1k', '2k'],
                },
                quality: {
                    type: 'string',
                    enum: ['low', 'medium'],
                },
                response_format: {
                    type: 'string',
                    enum: ['url', 'b64_json'],
                },
                n: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                },
            },
            required: ['_option_id'],
            additionalProperties: false,
        },
    },
};
