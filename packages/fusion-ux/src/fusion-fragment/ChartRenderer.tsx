/**
 * Chart Renderer Component
 *
 * Renders Vega-Lite charts within fusion fragments.
 * Uses the ChartComponent from context when available, otherwise shows a placeholder.
 */

import type { ReactElement } from 'react';
import type { ChartTemplate } from '../types.js';
import { useFusionFragmentContextSafe } from './FusionFragmentContext.js';

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
export function ChartRenderer({
  chart,
  data,
  className
}: ChartRendererProps): ReactElement {
  const context = useFusionFragmentContextSafe();
  const ChartComponent = context?.ChartComponent;
  const artifactRunId = context?.artifactRunId;

  // Debug logging
  console.log('[ChartRenderer] Context:', {
    hasContext: !!context,
    hasChartComponent: !!ChartComponent,
    artifactRunId,
    chartTitle: chart.title,
    dataKey: chart.dataKey,
  });

  // Resolve data from context if dataKey is provided
  const resolvedSpec = { ...chart.spec };

  if (chart.dataKey && data[chart.dataKey]) {
    const chartData = data[chart.dataKey];
    if (Array.isArray(chartData)) {
      // Inject data into spec
      resolvedSpec.data = { values: chartData as Record<string, unknown>[] };
    }
  }

  // Build the VegaLiteChartSpec format expected by @vertesia/ui
  const vegaSpec = {
    library: 'vega-lite' as const,
    title: chart.title,
    description: chart.description,
    spec: resolvedSpec,
    options: {
      height: chart.height,
    }
  };

  // If a ChartComponent is provided via context, use it to render the actual chart
  if (ChartComponent) {
    return (
      <div className={className}>
        <ChartComponent spec={vegaSpec} artifactRunId={artifactRunId} />
      </div>
    );
  }

  // Fallback: render a placeholder with spec info when no ChartComponent is injected
  return (
    <div
      className={className}
      style={{
        padding: '16px',
        backgroundColor: 'var(--gray-2, #f9fafb)',
        border: '1px solid var(--gray-5, #e5e7eb)',
        borderRadius: '8px',
        minHeight: chart.height || 280
      }}
    >
      {chart.title && (
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--gray-12, #111827)'
          }}
        >
          {chart.title}
        </div>
      )}
      {chart.description && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--gray-11, #6b7280)',
            marginBottom: '12px'
          }}
        >
          {chart.description}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: (chart.height || 280) - 60,
          backgroundColor: 'var(--gray-3, #f3f4f6)',
          borderRadius: '4px',
          color: 'var(--gray-11, #6b7280)',
          fontSize: '12px'
        }}
        data-vega-spec={JSON.stringify(vegaSpec)}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '4px' }}>
            Chart: {resolvedSpec.mark ? String(typeof resolvedSpec.mark === 'string' ? resolvedSpec.mark : resolvedSpec.mark.type) : 'composite'}
          </div>
          {resolvedSpec.data?.values && (
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              {resolvedSpec.data.values.length} data points
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
