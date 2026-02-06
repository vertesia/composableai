import { memo } from 'react';
import { VegaLiteChart } from './VegaLiteChart';

// Legacy Recharts chart specification.
// Recharts rendering has been retired; this type is kept for backward-compatibility.
export type RechartsChartSpec = {
  version?: '1.0';
  library?: 'recharts';
  [key: string]: unknown;
};

// Vega-Lite chart specification for supported visualizations.
export type VegaLiteChartSpec = {
  version?: '1.0';
  library: 'vega-lite';
  title?: string;
  description?: string;
  spec: Record<string, unknown>;
  options?: {
    collapsible?: boolean;
    collapseInitially?: boolean;
    theme?: 'default' | 'dark';
    renderer?: 'canvas' | 'svg';
    mode?: 'chart' | 'dashboard';
    height?: number;
    enableFullscreen?: boolean;
    enableTooltips?: boolean;
    enableSignalListeners?: boolean;
    parameterValues?: Record<string, unknown>;
  };
};

export type AgentChartSpec = RechartsChartSpec | VegaLiteChartSpec;

export function isVegaLiteSpec(spec: AgentChartSpec): spec is VegaLiteChartSpec {
  return spec.library === 'vega-lite' && typeof (spec as VegaLiteChartSpec).spec === 'object';
}

export function isRechartsSpec(spec: AgentChartSpec): spec is RechartsChartSpec {
  return spec.library === 'recharts' || spec.library === undefined;
}

type AgentChartProps = {
  spec: AgentChartSpec;
  artifactRunId?: string;
};

function isNativeVegaLiteSpec(spec: AgentChartSpec): spec is Record<string, unknown> {
  return typeof (spec as Record<string, unknown>).$schema === 'string' &&
    ((spec as Record<string, unknown>).$schema as string).includes('vega');
}

export const AgentChart = memo(function AgentChart({ spec, artifactRunId }: AgentChartProps) {
  if (isVegaLiteSpec(spec)) {
    return <VegaLiteChart spec={spec} artifactRunId={artifactRunId} />;
  }

  if (isNativeVegaLiteSpec(spec)) {
    return <VegaLiteChart spec={{ library: 'vega-lite', spec }} artifactRunId={artifactRunId} />;
  }

  return (
    <div className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Recharts chart rendering has been retired. Use a Vega-Lite chart spec (<code>library: &quot;vega-lite&quot;</code> with <code>spec</code>).
    </div>
  );
}, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec)
    && prevProps.artifactRunId === nextProps.artifactRunId;
});
