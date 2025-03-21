import { BillingMethod } from "./user.js";


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


export interface StripeBillingStatusResponse {
    status: 'enabled' | 'disabled',
    billing_method: BillingMethod | null,
    portal_url?: string,
    reason?: string
}