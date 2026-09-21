import { z } from 'zod';

// Zod renders a union as `anyOf`, while the published contract uses JSON Schema's compact type
// array. Runtime enforcement compiles the emitted JSON Schema with AJV, so the metadata is both the
// published shape and the validator; the annotation keeps the inferred TypeScript type equally
// narrow.
const timeBoundarySchema: z.ZodType<string | number> = z.any().meta({ type: ['string', 'number'] });

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
            ])
            .meta({ description: 'Group results by this dimension' })
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
    .meta({ id: 'CostAnalyticsQuery' });

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
    .meta({ id: 'CostRunPriceQuery' });

export const CostModelPricesQuerySchema = z
    .object({
        from: timeBoundarySchema.meta({ description: 'Start time (ISO string or epoch ms)' }).optional(),
        to: timeBoundarySchema.meta({ description: 'End time (ISO string or epoch ms)' }).optional(),
    })
    .meta({ id: 'CostModelPricesQuery' });

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
    .meta({ id: 'CostExportQuery' });

export const ModelPricingSchema = z
    .strictObject({
        model: z.string(),
        provider: z.string().optional(),
        provider_account_id: z.string().optional(),
        service_tier: z.string().meta({ description: 'Processing tier this price applies to' }).optional(),
        input_price_per_m_tokens: z.number(),
        cached_input_price_per_m_tokens: z.number().optional(),
        cache_write_input_price_per_m_tokens: z.number().optional(),
        output_price_per_m_tokens: z.number(),
        source: z.enum(['billing_export', 'model_pricing_daily', 'unavailable']),
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
