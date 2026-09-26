import { BILLABLE_AUDIT_ACTIONS } from './audit-trail.js';
import type * as Wire from './wire-types.generated.js';

export { BILLABLE_AUDIT_ACTIONS };

// ============================================================================
// Query
// ============================================================================

export type CostAnalyticsQuery = Wire.CostAnalyticsQuery;

export type CostModelPricesQuery = Wire.CostModelPricesQuery;

export type CostExportQuery = Wire.CostExportQuery;

// ============================================================================
// Response
// ============================================================================

export type CostSummary = Wire.CostSummary;

export type CostByDimension = Wire.CostByDimension;

export type CostTimeSeriesPoint = Wire.CostTimeSeriesPoint;

export type ModelPricing = Wire.ModelPricing;

export type ModelPriceComparison = Wire.ModelPriceComparison;

export type ModelPriceComparisonResponse = Wire.ModelPriceComparisonResponse;

export type CostAnalyticsResponse = Wire.CostAnalyticsResponse;

export type CostRunPriceQuery = Wire.CostRunPriceQuery;

export type CostRunPriceResponse = Wire.CostRunPriceResponse;
