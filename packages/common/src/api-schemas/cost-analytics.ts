import { z } from 'zod';
import { conditional, nonEmpty } from './schema-primitives.js';

// Zod renders a union as `anyOf`, while the published contract uses JSON Schema's compact type
// array. Runtime enforcement compiles the emitted JSON Schema with AJV, so the metadata is both the
// published shape and the validator; the annotation keeps the inferred TypeScript type equally
// narrow.
//
// The numeric bounds are the epoch milliseconds of 0001-01-01T00:00:00.000Z and 9999-12-31T23:59:59.999Z, the
// instants the analytics backends can read; the server refuses an epoch outside them. They apply to the number
// branch only. A string bound is read by `Date.parse`, whose accepted forms JSON Schema cannot state.
const timeBoundarySchema: z.ZodType<string | number> = z
    .any()
    .meta({ type: ['string', 'number'], minimum: -62_135_596_800_000, maximum: 253_402_300_799_999 });

const TIME_BOUND_DESCRIPTION = '`from` and `to` are ISO 8601 date-times or epoch milliseconds, within years 1 to 9999.';
const ANALYTICS_WINDOW_DESCRIPTION = 'The window from `from` to `to` (now when absent) may span at most 366 days.';

export const PricingSyncPayloadSchema = z
    .strictObject({
        date: z.string().optional(),
        backfill_from: z.string().optional(),
    })
    .meta({ id: 'PricingSyncPayload' });

export const PricingSyncDayResultSchema = z
    .strictObject({
        date: z.string(),
        gcp_list: z.number(),
        gcp_effective: z.number(),
        aws_pricing: z.number(),
        xai_pricing: z.number(),
        openrouter_pricing: z.number(),
        openai_costs: z.number(),
    })
    .meta({ id: 'PricingSyncDayResult' });

export const PricingSyncResultSchema = z
    .strictObject({
        days: z.array(PricingSyncDayResultSchema),
        total_days: z.number(),
    })
    .meta({ id: 'PricingSyncResult' });

export const CostAnalyticsQuerySchema = z
    .strictObject({
        from: timeBoundarySchema.meta({ description: 'Start time (ISO string or epoch ms)' }).optional(),
        to: timeBoundarySchema.meta({ description: 'End time (ISO string or epoch ms)' }).optional(),
        group_by: z
            .enum([
                'model',
                'environment',
                'account',
                'project',
                'project_tag',
                'provider',
                'service_tier',
                'interaction',
                'workflow',
                'agent_run',
                'workflow_run',
                'source',
            ])
            .meta({
                description:
                    'Group results by this dimension. `agent_run` groups by root agent run, including the calls of ' +
                    'its sub-agents; `workflow_run` groups by Temporal workflow run, which separates each sub-agent. ' +
                    '`source` groups by what the calls were spent on: `agent`, `process` (with its agents), ' +
                    '`intake`, `workflow` (any other workflow), `search` (query embeddings) or `interaction` (calls ' +
                    'outside a workflow). Calls recorded before source tracking can also read `agent_or_process` ' +
                    'or `embedding` (an embedding of unknown purpose).',
            })
            .optional(),
        resolution: z.enum(['hour', 'day', 'week', 'month']).meta({ description: 'Time series resolution' }).optional(),
        model: z.string().meta({ description: 'Filter by model pattern' }).optional(),
        environment_id: z.string().meta({ description: 'Filter by environment ID' }).optional(),
        provider: z.string().meta({ description: 'Filter by provider' }).optional(),
        service_tier: z.string().meta({ description: 'Filter by resolved processing tier' }).optional(),
        project_id: z.string().meta({ description: 'Filter by project ID (optional, for org scope)' }).optional(),
        workflow_id: z.string().meta({ description: 'Filter by workflow / agent run ID' }).optional(),
        workflow_run_id: z.string().meta({ description: 'Filter by Temporal workflow run ID' }).optional(),
        run_id: z.string().meta({ description: 'Filter by interaction execution run ID' }).optional(),
        agent_run_id: z.string().meta({ description: 'Filter by agent run ID' }).optional(),
        agent_only: z
            .boolean()
            .meta({
                description:
                    'Restrict usage to agent runs and their attributed nested/background inference. ' +
                    'Excludes standalone interactions and non-agent workflows. Defaults to false.',
            })
            .optional(),
        interaction_id: z
            .string()
            .meta({ description: 'Filter by interaction id: stored ObjectId or namespaced in-code id' })
            .optional(),
        principal_id: z
            .string()
            .meta({
                description:
                    'Filter by principal (bare user or API key id; matched against the suffix of principal_id)',
            })
            .optional(),
        account_id: z.string().meta({ description: 'Filter by account ID (set automatically by server)' }).optional(),
        scope: z
            .enum(['project', 'org'])
            .meta({ description: "Scope: 'project' (default, current project) or 'org' (all projects in account)" })
            .optional(),
        pricing_source: z
            .enum(['list', 'historical'])
            .meta({
                description:
                    "Pricing source: 'list' (latest daily prices) or 'historical' (daily effective prices over the query range). Default: 'list'",
            })
            .optional(),
        no_cache: z.boolean().meta({ description: 'Skip cache and force fresh query' }).optional(),
    })
    .meta({ id: 'CostAnalyticsQuery', description: `${TIME_BOUND_DESCRIPTION} ${ANALYTICS_WINDOW_DESCRIPTION}` });

export const CostRunPriceQuerySchema = z
    .strictObject({
        run_id: z.string().meta({ description: 'Interaction execution run ID' }).optional(),
        agent_run_id: z.string().meta({ description: 'Agent run ID' }).optional(),
        workflow_id: z.string().meta({ description: 'Workflow ID, when known' }).optional(),
        workflow_run_id: z.string().meta({ description: 'Temporal workflow run ID, when known' }).optional(),
        from: timeBoundarySchema.meta({ description: 'Optional lower bound for audit events' }).optional(),
        to: timeBoundarySchema.meta({ description: 'Optional upper bound for audit events' }).optional(),
        pricing_source: z
            .enum(['list', 'historical'])
            .meta({ description: 'Pricing source. Defaults to historical effective prices for run pricing.' })
            .optional(),
        include_comparison_pricing: z
            .boolean()
            .meta({ description: 'Include the full pricing catalog for cross-model comparison. Defaults to false.' })
            .optional(),
        project_id: z
            .string()
            .meta({ description: 'Project filter; server fills current project by default' })
            .optional(),
        account_id: z.string().meta({ description: 'Account filter; server fills current account' }).optional(),
        scope: z
            .enum(['project', 'org'])
            .meta({ description: "Scope: 'project' (default, current project) or 'org'" })
            .optional(),
    })
    .meta({
        id: 'CostRunPriceQuery',
        description:
            'Identifies the run to price by at least one of `run_id`, `agent_run_id`, `workflow_id` or ' +
            `\`workflow_run_id\`. An empty identifier counts as absent. ${TIME_BOUND_DESCRIPTION} ` +
            ANALYTICS_WINDOW_DESCRIPTION,
        ...conditional(
            { not: { anyOf: ['run_id', 'agent_run_id', 'workflow_id'].map(nonEmpty) } },
            nonEmpty('workflow_run_id'),
        ),
    });

export const CostModelPricesQuerySchema = z
    .object({
        from: timeBoundarySchema.meta({ description: 'Start time (ISO string or epoch ms)' }).optional(),
        to: timeBoundarySchema.meta({ description: 'End time (ISO string or epoch ms)' }).optional(),
    })
    .meta({ id: 'CostModelPricesQuery', description: TIME_BOUND_DESCRIPTION });

export const CostExportQuerySchema = z
    .object({
        from: timeBoundarySchema.meta({ description: 'Start time (ISO string or epoch ms)' }).optional(),
        to: timeBoundarySchema.meta({ description: 'End time (ISO string or epoch ms)' }).optional(),
        scope: z
            .enum(['project', 'org'])
            .meta({ description: "Scope: 'project' (default, current project) or 'org' (all projects in account)" })
            .optional(),
        project_id: z.string().meta({ description: 'Filter by project ID (optional, for org scope)' }).optional(),
        workflow_id: z.string().meta({ description: 'Filter by workflow / agent run ID' }).optional(),
    })
    .meta({ id: 'CostExportQuery', description: `${TIME_BOUND_DESCRIPTION} ${ANALYTICS_WINDOW_DESCRIPTION}` });

export const ModelPricingSchema = z
    .strictObject({
        model: z.string(),
        provider: z.string().optional(),
        provider_account_id: z.string().optional(),
        service_tier: z.string().meta({ description: 'Processing tier this price applies to' }).optional(),
        min_prompt_tokens: z
            .number()
            .int()
            .nonnegative()
            .meta({
                description:
                    'When set, these prices apply to calls whose prompt (input, cached and cache-write tokens) is ' +
                    'longer than this many tokens, in place of the prices without it.',
            })
            .optional(),
        input_price_per_m_tokens: z.number(),
        cached_input_price_per_m_tokens: z.number().optional(),
        cache_write_input_price_per_m_tokens: z.number().optional(),
        output_price_per_m_tokens: z.number(),
        source: z.enum(['billing_export', 'model_pricing_daily', 'run_time_estimate', 'unavailable']).meta({
            description:
                'Where the rates come from. `run_time_estimate` rates are the ones recorded on the calls when their ' +
                'cost was estimated; the others come from the pricing catalog.',
        }),
    })
    .meta({ id: 'ModelPricing' });

export const CostTimeSeriesPointSchema = z
    .strictObject({
        timestamp: z.string(),
        cost: z.number(),
        input_tokens: z.number(),
        cached_input_tokens: z.number().optional(),
        cache_write_input_tokens: z.number().optional(),
        output_tokens: z.number(),
        calls: z.number(),
    })
    .meta({ id: 'CostTimeSeriesPoint' });

export const CostSummarySchema = z
    .strictObject({
        total_cost: z.number(),
        total_input_tokens: z.number(),
        total_cached_input_tokens: z.number().optional(),
        total_cache_write_input_tokens: z.number().optional(),
        total_output_tokens: z.number(),
        total_calls: z.number(),
        total_duration_ms: z.number(),
    })
    .meta({ id: 'CostSummary' });

export const ModelPriceComparisonSchema = z
    .strictObject({
        model: z.string(),
        provider: z.string().optional(),
        provider_account_id: z.string().optional(),
        service_tier: z.string().meta({ description: 'Processing tier this price applies to' }).optional(),
        list_price_date: z.string().optional(),
        effective_from: z.string().optional(),
        effective_to: z.string().optional(),
        input_list_price_per_m_tokens: z.number().optional(),
        input_effective_price_per_m_tokens: z.number().optional(),
        cached_input_list_price_per_m_tokens: z.number().optional(),
        cached_input_effective_price_per_m_tokens: z.number().optional(),
        cache_write_input_list_price_per_m_tokens: z.number().optional(),
        cache_write_input_effective_price_per_m_tokens: z.number().optional(),
        output_list_price_per_m_tokens: z.number().optional(),
        output_effective_price_per_m_tokens: z.number().optional(),
        source: z.literal('model_pricing_daily'),
    })
    .meta({ id: 'ModelPriceComparison' });

export const CostByDimensionSchema = z
    .strictObject({
        dimension: z.string(),
        label: z.string().optional(),
        provider: z.string().optional(),
        service_tier: z.string().optional(),
        cost: z.number(),
        input_tokens: z.number(),
        cached_input_tokens: z.number().optional(),
        cache_write_input_tokens: z.number().optional(),
        output_tokens: z.number(),
        calls: z.number(),
        periods: z.array(CostTimeSeriesPointSchema).optional(),
    })
    .meta({ id: 'CostByDimension' });

const PricingCoverageSchema = z.strictObject({
    priced_calls: z.number(),
    unpriced_calls: z.number(),
    assumed_default_calls: z.number(),
    unpriced: z.array(
        z.strictObject({
            model: z.string(),
            provider: z.string().optional(),
            service_tier: z.string(),
            calls: z.number(),
        }),
    ),
    cost_by_source: z
        .strictObject({
            provider_billed: z.number().meta({ description: 'USD the provider reported billing for the calls.' }),
            run_time_estimate: z.number().meta({
                description: 'USD estimated from list prices when the calls ran, for calls with no billed amount.',
            }),
            price_table: z.number().meta({
                description: 'USD computed from the pricing table, for calls with no cost recorded when they ran.',
            }),
        })
        .optional()
        .meta({ description: "How the total cost splits by where each call's cost came from." }),
});

export const ModelPriceComparisonResponseSchema = z
    .strictObject({
        prices: z.array(ModelPriceComparisonSchema),
        effective_range: z.strictObject({
            from: z.string(),
            to: z.string(),
        }),
        list_price_date: z.string().optional(),
    })
    .meta({ id: 'ModelPriceComparisonResponse' });

export const CostAnalyticsResponseSchema = z
    .strictObject({
        summary: CostSummarySchema,
        by_dimension: z.array(CostByDimensionSchema),
        time_series: z.array(CostTimeSeriesPointSchema),
        pricing: z.array(ModelPricingSchema),
        pricing_coverage: PricingCoverageSchema.optional(),
        query_range: z.strictObject({
            from: z.string(),
            to: z.string(),
        }),
        cached: z.boolean(),
    })
    .meta({ id: 'CostAnalyticsResponse' });

export const CostRunPriceResponseSchema = z
    .strictObject({
        summary: CostSummarySchema,
        by_model: z.array(CostByDimensionSchema),
        pricing: z.array(ModelPricingSchema).optional(),
        pricing_coverage: PricingCoverageSchema.optional(),
        query_range: z
            .strictObject({
                from: z.string(),
                to: z.string(),
            })
            .optional(),
        pricing_source: z.enum(['list', 'historical']),
        matched_events: z.number(),
    })
    .meta({ id: 'CostRunPriceResponse' });

export const ObjectIntakeCostQuerySchema = z
    .strictObject({
        limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .meta({ description: 'Most recent intake runs to list (default 50). Totals always cover every run.' })
            .optional(),
    })
    .meta({ id: 'ObjectIntakeCostQuery' });

const intakeCountsSchema = z.record(z.string(), z.number());

export const IntakeRunCostSchema = z
    .strictObject({
        root_run_id: z.string().meta({
            description: 'First run ID of the intake workflow, shared by its continued runs and child workflows.',
        }),
        object_id: z.string().meta({ description: 'The version of the document the run processed.' }),
        workflow_id: z.string().optional(),
        workflow_type: z.string().optional(),
        outcome: z
            .enum(['completed', 'skipped', 'failed'])
            .meta({ description: 'How the run ended. Absent while it runs, or when it closed without reporting.' })
            .optional(),
        content_type_id: z
            .string()
            .meta({ description: 'Content type of the document when the run ended.' })
            .optional(),
        content_type_name: z.string().optional(),
        content_nature: z.string().optional(),
        page_count: z.number().int().optional(),
        started_at: z.string().meta({ format: 'date-time', description: 'First billable call or closing event.' }),
        last_event_at: z.string().meta({ format: 'date-time' }),
        closed_at: z.string().meta({ format: 'date-time' }).optional(),
        cost_usd: z.number().meta({
            description:
                'What the priced calls cost: the amount the provider billed when it reported one, else the list-price ' +
                'estimate recorded with the call.',
        }),
        priced_calls: z.number().int(),
        unpriced_calls: z
            .number()
            .int()
            .meta({ description: 'Calls with no price, left out of `cost_usd`; their tokens are still counted.' }),
        failed_calls: z.number().int(),
        calls: intakeCountsSchema.meta({ description: 'Billable calls by audit action (`inference`, `embedding`).' }),
        tokens: intakeCountsSchema.meta({ description: 'Tokens by meter type (`input`, `output`, ...).' }),
    })
    .meta({ id: 'IntakeRunCost', description: 'The cost of one intake run of a content object.' });

export const IntakeCostVersionSchema = z
    .strictObject({
        object_id: z.string(),
        label: z.string().meta({ description: 'The label given to the version, if any.' }).optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        head: z.boolean().meta({ description: 'Whether this is the latest version of the document.' }),
    })
    .meta({ id: 'IntakeCostVersion', description: 'A version of a document whose intake runs a cost covers.' });

export const ObjectIntakeCostResponseSchema = z
    .strictObject({
        object_id: z.string(),
        versions: z.array(IntakeCostVersionSchema).meta({
            description:
                'The versions the cost covers, newest first. For the latest version of a document: every version the ' +
                'caller can read. For an earlier version: that version alone.',
        }),
        run_count: z.number().int().meta({ description: 'Intake runs recorded for the versions covered.' }),
        cost_usd: z.number().meta({ description: 'Sum of `cost_usd` over every run of the versions covered.' }),
        priced_calls: z.number().int(),
        unpriced_calls: z.number().int(),
        runs: z.array(IntakeRunCostSchema).meta({ description: 'The most recent runs, newest first.' }),
    })
    .meta({
        id: 'ObjectIntakeCostResponse',
        description:
            'The LLM and embedding cost of the intake workflows that processed a content object, recorded since ' +
            'intake cost tracking was deployed. The latest version of a document covers all its versions.',
    });

export const IntakeCostSummaryQuerySchema = z
    .strictObject({
        from: timeBoundarySchema
            .meta({ description: 'Start of the window, on the start of each run. Default: 30 days before `to`.' })
            .optional(),
        to: timeBoundarySchema.meta({ description: 'End of the window, exclusive. Default: now.' }).optional(),
        resolution: z
            .enum(['hour', 'day', 'week', 'month'])
            .meta({ description: 'Period of the time series, in UTC; weeks start on Monday. Default: `day`.' })
            .optional(),
        content_type_id: z.string().meta({ description: 'Only the runs that ended on this content type.' }).optional(),
    })
    .meta({
        id: 'IntakeCostSummaryQuery',
        description: `${TIME_BOUND_DESCRIPTION} ${ANALYTICS_WINDOW_DESCRIPTION}`,
    });

const INTAKE_COST_USD_DESCRIPTION =
    'What the priced calls cost: the amount the provider billed when it reported one, else the list-price estimate.';

export const IntakeCostTotalsSchema = z
    .strictObject({
        run_count: z.number().int(),
        document_count: z
            .number()
            .int()
            .meta({ description: 'Distinct documents the runs processed; the versions of a document count once.' }),
        cost_usd: z.number().meta({ description: INTAKE_COST_USD_DESCRIPTION }),
        priced_calls: z.number().int(),
        unpriced_calls: z
            .number()
            .int()
            .meta({ description: 'Calls with no price, left out of `cost_usd`; their tokens are still counted.' }),
        failed_calls: z.number().int(),
        page_count: z.number().int().meta({ description: 'Pages of the runs that reported a page count.' }),
        tokens: intakeCountsSchema.meta({ description: 'Tokens by meter type (`input`, `output`, ...).' }),
    })
    .meta({ id: 'IntakeCostTotals', description: 'Totals over the intake runs of a window.' });

export const IntakeCostTimePointSchema = z
    .strictObject({
        timestamp: z.string().meta({ format: 'date-time', description: 'Start of the period, in UTC.' }),
        run_count: z.number().int(),
        cost_usd: z.number(),
    })
    .meta({ id: 'IntakeCostTimePoint', description: 'Intake runs that started in one period.' });

export const IntakeCostByContentTypeSchema = z
    .strictObject({
        content_type_id: z
            .string()
            .meta({ description: 'Absent for runs that ended without a content type, or never reported one.' })
            .optional(),
        content_type_name: z.string().optional(),
        run_count: z.number().int(),
        document_count: z.number().int(),
        cost_usd: z.number(),
        page_count: z.number().int(),
    })
    .meta({ id: 'IntakeCostByContentType', description: 'Intake runs of one content type.' });

export const IntakeCostPerPageSchema = z
    .strictObject({
        run_count: z.number().int().meta({ description: 'Runs that reported a page count.' }),
        page_count: z.number().int(),
        cost_usd: z.number().meta({ description: 'What these runs cost.' }),
        average_usd: z.number().meta({ description: 'Their cost over their pages.' }),
        median_usd: z.number().meta({ description: 'The median of the cost per page of each run.' }),
        p95_usd: z.number().meta({ description: 'The 95th percentile of the cost per page of each run.' }),
    })
    .meta({ id: 'IntakeCostPerPage', description: 'The cost per page of the intake runs that reported a page count.' });

export const IntakeCostByContentNatureSchema = z
    .strictObject({
        content_nature: z
            .string()
            .meta({
                description:
                    'The kind of content: `document`, `image`, `audio`, `video`, `code` or `other`. Absent for runs ' +
                    'that never reported one.',
            })
            .optional(),
        run_count: z.number().int(),
        document_count: z.number().int(),
        cost_usd: z.number(),
        page_count: z.number().int().meta({ description: 'Pages of the runs that reported a page count.' }),
        duration_seconds: z
            .number()
            .meta({ description: 'Length of the audio and video of the runs that reported one, in seconds.' }),
        cost_per_minute_usd: z
            .number()
            .meta({
                description:
                    'The cost of the runs that reported a length over their minutes. Absent when none reported one.',
            })
            .optional(),
    })
    .meta({ id: 'IntakeCostByContentNature', description: 'Intake runs of one kind of content.' });

export const IntakeCostByOutcomeSchema = z
    .strictObject({
        outcome: z.enum(['completed', 'skipped', 'failed', 'not_reported']).meta({
            description: '`not_reported` covers runs still going and runs that closed without reporting.',
        }),
        run_count: z.number().int(),
        cost_usd: z.number(),
    })
    .meta({ id: 'IntakeCostByOutcome', description: 'Intake runs that ended one way.' });

export const IntakeCostDocumentSchema = z
    .strictObject({
        object_id: z.string().meta({
            description:
                'The latest version of the document the caller can read, else the first version of the document.',
        }),
        name: z.string().meta({ description: 'Absent when the caller cannot read the document.' }).optional(),
        content_type_name: z.string().optional(),
        run_count: z.number().int(),
        cost_usd: z.number(),
    })
    .meta({
        id: 'IntakeCostDocument',
        description: 'The intake cost of one document over a window, all its versions included.',
    });

export const IntakeCostSummaryResponseSchema = z
    .strictObject({
        from: z.string().meta({ format: 'date-time' }),
        to: z.string().meta({ format: 'date-time' }),
        resolution: z.enum(['hour', 'day', 'week', 'month']),
        totals: IntakeCostTotalsSchema,
        time_series: z.array(IntakeCostTimePointSchema).meta({ description: 'Periods that had runs, oldest first.' }),
        per_page: IntakeCostPerPageSchema.meta({ description: 'Absent when no run reported a page count.' }).optional(),
        by_content_type: z.array(IntakeCostByContentTypeSchema).meta({ description: 'Most expensive first.' }),
        by_content_nature: z.array(IntakeCostByContentNatureSchema).meta({ description: 'Most expensive first.' }),
        by_outcome: z.array(IntakeCostByOutcomeSchema).meta({ description: 'Most expensive first.' }),
        top_documents: z
            .array(IntakeCostDocumentSchema)
            .meta({ description: 'The 10 most expensive documents of the window, most expensive first.' }),
    })
    .meta({
        id: 'IntakeCostSummaryResponse',
        description:
            'The LLM and embedding cost of the intake runs of the current project that started in a window, recorded ' +
            'since intake cost tracking was deployed.',
    });
