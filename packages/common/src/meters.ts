import type { z } from 'zod';
import type { StripeBillingStatusResponseSchema } from './api-schemas/account.js';

interface MeterAdjustment {
    meter: string;
    value: string;
    identifier?: string;
}

export interface AdjustMetersMeterWorkflowParams {
    adjustments: MeterAdjustment[];
}

/**
 * Stripe billing status, derived from `StripeBillingStatusResponseSchema`.
 *
 * A real discriminated union rather than the flat object this used to be: the server sets
 * `portal_url` only when enabled and `reason` only when disabled, and the flat shape gave every
 * generated client two unrelated optionals with no way to tell which was populated. Narrowing on
 * `status` now tells TypeScript which fields exist.
 */
export type StripeBillingStatusResponse = z.infer<typeof StripeBillingStatusResponseSchema>;
