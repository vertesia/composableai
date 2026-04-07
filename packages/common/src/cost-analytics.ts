/**
 * Cost Analytics Types
 *
 * Types for the cost attribution dashboard.
 * Combines audit trail metering data with billing export pricing
 * to compute per-org/project/env/model cost breakdowns.
 */

import { BILLABLE_AUDIT_ACTIONS } from './audit-trail.js';

export { BILLABLE_AUDIT_ACTIONS };

// ============================================================================
// Query
// ============================================================================

export interface CostAnalyticsQuery {
    /** Start time (ISO string or epoch ms) */
    from?: string | number;
    /** End time (ISO string or epoch ms) */
    to?: string | number;
    /** Group results by this dimension */
    group_by?: 'model' | 'environment' | 'account' | 'project' | 'provider' | 'interaction';
    /** Time series resolution */
    resolution?: 'hour' | 'day' | 'week' | 'month';
    /** Filter by model pattern */
    model?: string;
    /** Filter by environment ID */
    environment_id?: string;
    /** Filter by provider */
    provider?: string;
    /** Filter by project ID (optional, for org scope) */
    project_id?: string;
    /** Filter by account ID (set automatically by server) */
    account_id?: string;
    /** Scope: 'project' (default, current project) or 'org' (all projects in account) */
    scope?: 'project' | 'org';
    /** Pricing source: 'list' (current list prices) or 'historical' (actual prices from billing period). Default: 'list' */
    pricing_source?: 'list' | 'historical';
    /** Skip cache and force fresh query */
    no_cache?: boolean;
}

// ============================================================================
// Response
// ============================================================================

export interface CostSummary {
    total_cost: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_calls: number;
    total_duration_ms: number;
}

export interface CostByDimension {
    dimension: string;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    calls: number;
}

export interface CostTimeSeriesPoint {
    timestamp: string;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    calls: number;
}

export interface ModelPricing {
    model: string;
    input_price_per_m_tokens: number;
    output_price_per_m_tokens: number;
    source: 'billing_export' | 'unavailable';
}

export interface CostAnalyticsResponse {
    summary: CostSummary;
    by_dimension: CostByDimension[];
    time_series: CostTimeSeriesPoint[];
    pricing: ModelPricing[];
    query_range: { from: string; to: string };
    cached: boolean;
}
