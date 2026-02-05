import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFusionFragmentContextSafe } from './FusionFragmentContext.js';
/**
 * Renders a Vega-Lite chart from a chart template.
 * If dataKey is provided, it merges data from context into the spec.
 * Uses the ChartComponent from FusionFragmentContext if available.
 */
export function ChartRenderer({ chart, data, className }) {
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
            resolvedSpec.data = { values: chartData };
        }
    }
    // Build the VegaLiteChartSpec format expected by @vertesia/ui
    const vegaSpec = {
        library: 'vega-lite',
        title: chart.title,
        description: chart.description,
        spec: resolvedSpec,
        options: {
            height: chart.height,
        }
    };
    // If a ChartComponent is provided via context, use it to render the actual chart
    if (ChartComponent) {
        return (_jsx("div", { className: className, children: _jsx(ChartComponent, { spec: vegaSpec, artifactRunId: artifactRunId }) }));
    }
    // Fallback: render a placeholder with spec info when no ChartComponent is injected
    return (_jsxs("div", { className: className, style: {
            padding: '16px',
            backgroundColor: 'var(--gray-2, #f9fafb)',
            border: '1px solid var(--gray-5, #e5e7eb)',
            borderRadius: '8px',
            minHeight: chart.height || 280
        }, children: [chart.title && (_jsx("div", { style: {
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: 'var(--gray-12, #111827)'
                }, children: chart.title })), chart.description && (_jsx("div", { style: {
                    fontSize: '12px',
                    color: 'var(--gray-11, #6b7280)',
                    marginBottom: '12px'
                }, children: chart.description })), _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: (chart.height || 280) - 60,
                    backgroundColor: 'var(--gray-3, #f3f4f6)',
                    borderRadius: '4px',
                    color: 'var(--gray-11, #6b7280)',
                    fontSize: '12px'
                }, "data-vega-spec": JSON.stringify(vegaSpec), children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsxs("div", { style: { marginBottom: '4px' }, children: ["Chart: ", resolvedSpec.mark ? String(typeof resolvedSpec.mark === 'string' ? resolvedSpec.mark : resolvedSpec.mark.type) : 'composite'] }), resolvedSpec.data?.values && (_jsxs("div", { style: { fontSize: '11px', opacity: 0.8 }, children: [resolvedSpec.data.values.length, " data points"] }))] }) })] }));
}
//# sourceMappingURL=ChartRenderer.js.map