/**
 * Chart Renderer Component
 *
 * Renders Vega-Lite charts within fusion fragments.
 * Uses the ChartComponent from context when available, otherwise shows a placeholder.
 */
import type { ReactElement } from 'react';
import type { ChartTemplate } from '../types.js';
export interface ChartRendererProps {
    /** Chart template configuration */
    chart: ChartTemplate;
    /** Data context for dataKey resolution */
    data: Record<string, unknown>;
    /** CSS class name */
    className?: string;
}
/**
 * Renders a Vega-Lite chart from a chart template.
 * If dataKey is provided, it merges data from context into the spec.
 * Uses the ChartComponent from FusionFragmentContext if available.
 */
export declare function ChartRenderer({ chart, data, className }: ChartRendererProps): ReactElement;
//# sourceMappingURL=ChartRenderer.d.ts.map