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

export type ObjectIntakeCostQuery = Wire.ObjectIntakeCostQuery;

/** The cost of one intake run of a content object. */
export type IntakeRunCost = Wire.IntakeRunCost;

/** The LLM and embedding cost of the intake workflows that processed a content object. */
export type ObjectIntakeCostResponse = Wire.ObjectIntakeCostResponse;

export type IntakeCostSummaryQuery = Wire.IntakeCostSummaryQuery;
export type IntakeCostTotals = Wire.IntakeCostTotals;
export type IntakeCostTimePoint = Wire.IntakeCostTimePoint;
export type IntakeCostByContentType = Wire.IntakeCostByContentType;
export type IntakeCostByOutcome = Wire.IntakeCostByOutcome;
export type IntakeCostDocument = Wire.IntakeCostDocument;

/** The LLM and embedding cost of a project's intake runs over a window. */
export type IntakeCostSummaryResponse = Wire.IntakeCostSummaryResponse;
