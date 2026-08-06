/**
 * Cost Analytics Types
 *
 * Types for the cost attribution dashboard.
 * Combines audit trail metering data with billing export pricing
 * to compute per-org/project/env/model cost breakdowns.
 */

import type { z } from 'zod';
import type {
    CostAnalyticsQuerySchema,
    CostAnalyticsResponseSchema,
    CostByDimensionSchema,
    CostExportQuerySchema,
    CostModelPricesQuerySchema,
    CostRunPriceQuerySchema,
    CostRunPriceResponseSchema,
    CostSummarySchema,
    CostTimeSeriesPointSchema,
    ModelPriceComparisonResponseSchema,
    ModelPriceComparisonSchema,
    ModelPricingSchema,
} from './api-schemas/cost-analytics.js';
import { BILLABLE_AUDIT_ACTIONS } from './audit-trail.js';

export { BILLABLE_AUDIT_ACTIONS };

// ============================================================================
// Query
// ============================================================================

export type CostAnalyticsQuery = z.infer<typeof CostAnalyticsQuerySchema>;

export type CostModelPricesQuery = z.infer<typeof CostModelPricesQuerySchema>;

export type CostExportQuery = z.infer<typeof CostExportQuerySchema>;

// ============================================================================
// Response
// ============================================================================

export type CostSummary = z.infer<typeof CostSummarySchema>;

export type CostByDimension = z.infer<typeof CostByDimensionSchema>;

export type CostTimeSeriesPoint = z.infer<typeof CostTimeSeriesPointSchema>;

export type ModelPricing = z.infer<typeof ModelPricingSchema>;

export type ModelPriceComparison = z.infer<typeof ModelPriceComparisonSchema>;

export type ModelPriceComparisonResponse = z.infer<typeof ModelPriceComparisonResponseSchema>;

export type CostAnalyticsResponse = z.infer<typeof CostAnalyticsResponseSchema>;

export type CostRunPriceQuery = z.infer<typeof CostRunPriceQuerySchema>;

export type CostRunPriceResponse = z.infer<typeof CostRunPriceResponseSchema>;
