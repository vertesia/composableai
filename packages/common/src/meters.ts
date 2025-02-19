




export interface MeterAdjustment {
    meter: string;
    value: string;
    identifier?: string;
}


export interface AdjustMetersMeterWorkflowParams {
    adjustments: MeterAdjustment[];
}