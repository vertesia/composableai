import type { StripeBillingStatusResponseFromSchema } from './api-schemas/account.js';

export interface MeterAdjustment {
    meter: string;
    value: string;
    identifier?: string;
}

export interface AdjustMetersMeterWorkflowParams {
    adjustments: MeterAdjustment[];
}

export enum MeterNames {
    analyzed_pages = 'analyzed_pages',
    extracted_tables = 'extracted_tables',
    analyzed_images = 'analyzed_images',
    input_token_used = 'input_token_used',
    output_token_used = 'output_token_used',
    task_run = 'task_run',
}

/**
 * Stripe billing status, derived from `StripeBillingStatusResponseSchema`.
 *
 * A real discriminated union rather than the flat object this used to be: the server sets
 * `portal_url` only when enabled and `reason` only when disabled, and the flat shape gave every
 * generated client two unrelated optionals with no way to tell which was populated. Narrowing on
 * `status` now tells TypeScript which fields exist.
 */
export type StripeBillingStatusResponse = StripeBillingStatusResponseFromSchema;
