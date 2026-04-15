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
    group_by?: 'model' | 'environment' | 'account' | 'project' | 'project_tag' | 'provider' | 'interaction' | 'workflow';
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
    /** Filter by workflow / agent run ID */
    workflow_id?: string;
    /** Filter by Temporal workflow run ID */
    workflow_run_id?: string;
    /** Filter by interaction execution run ID */
    run_id?: string;
    /** Filter by agent run ID */
    agent_run_id?: string;
    /** Filter by account ID (set automatically by server) */
    account_id?: string;
    /** Scope: 'project' (default, current project) or 'org' (all projects in account) */
    scope?: 'project' | 'org';
    /** Pricing source: 'list' (latest daily prices) or 'historical' (daily effective prices over the query range). Default: 'list' */
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
    total_cached_input_tokens?: number;
    total_cache_write_input_tokens?: number;
    total_output_tokens: number;
    total_calls: number;
    total_duration_ms: number;
}

export interface CostByDimension {
    dimension: string;
    label?: string;
    provider?: string;
    cost: number;
    input_tokens: number;
    cached_input_tokens?: number;
    cache_write_input_tokens?: number;
    output_tokens: number;
    calls: number;
    periods?: CostTimeSeriesPoint[];
}

export interface CostTimeSeriesPoint {
    timestamp: string;
    cost: number;
    input_tokens: number;
    cached_input_tokens?: number;
    cache_write_input_tokens?: number;
    output_tokens: number;
    calls: number;
}

export interface ModelPricing {
    model: string;
    provider?: string;
    provider_account_id?: string;
    input_price_per_m_tokens: number;
    cached_input_price_per_m_tokens?: number;
    cache_write_input_price_per_m_tokens?: number;
    output_price_per_m_tokens: number;
    source: 'billing_export' | 'model_pricing_daily' | 'unavailable';
}

export interface ModelPriceComparison {
    model: string;
    provider?: string;
    provider_account_id?: string;
    list_price_date?: string;
    effective_from?: string;
    effective_to?: string;
    input_list_price_per_m_tokens?: number;
    input_effective_price_per_m_tokens?: number;
    cached_input_list_price_per_m_tokens?: number;
    cached_input_effective_price_per_m_tokens?: number;
    cache_write_input_list_price_per_m_tokens?: number;
    cache_write_input_effective_price_per_m_tokens?: number;
    output_list_price_per_m_tokens?: number;
    output_effective_price_per_m_tokens?: number;
    source: 'model_pricing_daily';
}

export interface ModelPriceComparisonResponse {
    prices: ModelPriceComparison[];
    effective_range: { from: string; to: string };
    list_price_date?: string;
}

export interface CostAnalyticsResponse {
    summary: CostSummary;
    by_dimension: CostByDimension[];
    time_series: CostTimeSeriesPoint[];
    pricing: ModelPricing[];
    query_range: { from: string; to: string };
    cached: boolean;
}

export interface CostRunPriceQuery {
    /** Interaction execution run ID */
    run_id?: string;
    /** Agent run ID */
    agent_run_id?: string;
    /** Workflow ID, when known */
    workflow_id?: string;
    /** Temporal workflow run ID, when known */
    workflow_run_id?: string;
    /** Optional lower bound for audit events */
    from?: string | number;
    /** Optional upper bound for audit events */
    to?: string | number;
    /** Pricing source. Defaults to historical effective prices for run pricing. */
    pricing_source?: 'list' | 'historical';
    /** Include the full pricing catalog for cross-model comparison. Defaults to false. */
    include_comparison_pricing?: boolean;
    /** Project filter; server fills current project by default */
    project_id?: string;
    /** Account filter; server fills current account */
    account_id?: string;
    /** Scope: 'project' (default, current project) or 'org' */
    scope?: 'project' | 'org';
}

export interface CostRunPriceResponse {
    summary: CostSummary;
    by_model: CostByDimension[];
    pricing?: ModelPricing[];
    query_range?: { from: string; to: string };
    pricing_source: 'list' | 'historical';
    matched_events: number;
}
