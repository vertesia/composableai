import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    CostAnalyticsQuery,
    CostAnalyticsResponse,
    CostRunPriceQuery,
    ModelPriceComparisonResponse,
} from '../cost-analytics.js';
import type {
    CostAnalyticsQuerySchema,
    CostAnalyticsResponseSchema,
    CostRunPriceQuerySchema,
    ModelPriceComparisonResponseSchema,
} from './cost-analytics.js';
import { ApiSchemaComponents, validateApiRequest, validateApiResponse } from './registry.js';

describe('cost analytics API contracts', () => {
    it('derives the public types from the runtime schemas', () => {
        expectTypeOf<CostAnalyticsQuery>().toEqualTypeOf<import('zod').z.infer<typeof CostAnalyticsQuerySchema>>();
        expectTypeOf<CostAnalyticsResponse>().toEqualTypeOf<
            import('zod').z.infer<typeof CostAnalyticsResponseSchema>
        >();
        expectTypeOf<CostRunPriceQuery>().toEqualTypeOf<import('zod').z.infer<typeof CostRunPriceQuerySchema>>();
        expectTypeOf<ModelPriceComparisonResponse>().toEqualTypeOf<
            import('zod').z.infer<typeof ModelPriceComparisonResponseSchema>
        >();
    });

    it('accepts string and epoch time boundaries', () => {
        expect(validateApiRequest('CostAnalyticsQuery', { from: '2026-08-01T00:00:00Z' }).valid).toBe(true);
        expect(validateApiRequest('CostAnalyticsQuery', { from: 1_786_060_800_000 }).valid).toBe(true);
    });

    it('rejects undeclared request fields through the published component', () => {
        expect(validateApiRequest('CostRunPriceQuery', { run_id: 'run-1', hidden_filter: true }).valid).toBe(false);
    });

    it('validates the published model-price response', () => {
        const response: ModelPriceComparisonResponse = {
            prices: [
                {
                    model: 'gpt-5',
                    source: 'model_pricing_daily',
                    input_list_price_per_m_tokens: 1.25,
                },
            ],
            effective_range: { from: '2026-08-01', to: '2026-08-02' },
        };
        expect(validateApiResponse('ModelPriceComparisonResponse', response).valid).toBe(true);
    });

    it('registers the complete cost analytics closure', () => {
        for (const name of [
            'CostAnalyticsQuery',
            'CostRunPriceQuery',
            'CostModelPricesQuery',
            'CostExportQuery',
            'CostAnalyticsResponse',
            'ModelPriceComparisonResponse',
            'CostRunPriceResponse',
        ]) {
            expect(ApiSchemaComponents[name]).toBeDefined();
        }
    });
});
