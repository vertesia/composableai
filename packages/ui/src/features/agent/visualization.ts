/**
 * Visualization helpers for tools to emit chart specs that the UI can render.
 *
 * Format: ChartSpec v1 rendered by AgentChart component
 */

import type { AgentChartSpec } from './chat/AgentChart';

export type ChartSpecV1 = AgentChartSpec;

/**
 * Build a side-by-side bar chart comparing two scenarios across numeric metrics.
 */
export function buildScenarioComparisonBarChart(params: {
    title?: string;
    leftLabel: string;
    rightLabel: string;
    metrics: Array<{
        label: string;
        left: number;
        right: number;
    }>;
    description?: string;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, leftLabel, rightLabel, metrics, description, collapseInitially } = params;
    const data = metrics.map((m) => ({ label: m.label, left: m.left, right: m.right }));
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'bar',
        title: title || 'Scenario Comparison',
        description,
        data,
        xKey: 'label',
        series: [
            { key: 'left', label: leftLabel, type: 'bar' },
            { key: 'right', label: rightLabel, type: 'bar' },
        ],
        yAxis: { left: { label: 'Value' } },
        options: { stacked: false, referenceZero: false, collapseInitially },
    };
    return spec;
}

/**
 * Build a delta percentage bar chart to visualize changes between scenarios.
 */
export function buildScenarioDeltaPercentChart(params: {
    title?: string;
    metrics: Array<{
        label: string;
        left: number;
        right: number;
    }>;
    description?: string;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, metrics, description, collapseInitially } = params;
    const data = metrics.map((m) => ({
        label: m.label,
        deltaPct: m.left !== 0 ? ((m.right - m.left) / m.left) * 100 : 0,
    }));
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'bar',
        title: title || 'Change vs. Baseline (%)',
        description,
        data,
        xKey: 'label',
        series: [
            { key: 'deltaPct', label: '% Change', type: 'bar' },
        ],
        yAxis: { left: { label: '% Change' } },
        options: { stacked: false, referenceZero: true, collapseInitially },
    };
    return spec;
}

/**
 * Helper to wrap a chart spec in a markdown code fence the UI will render.
 */
export function toChartMarkdown(spec: ChartSpecV1): string {
    const json = JSON.stringify(spec, null, 2);
    return [
        '```chart',
        json,
        '```',
    ].join('\n');
}

/**
 * Build a cashflow composed chart (Calls/Distributions bars + Net Cashflow line)
 */
export function buildCashflowComposedChart(params: {
    title?: string;
    description?: string;
    rows: Array<{
        period: string; // e.g. '2024-Q1' or '2024'
        calls: number;
        distributions: number;
        netCashflow?: number;
    }>;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, description, rows, collapseInitially } = params;
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'composed',
        title: title || 'Cashflow Timeline',
        description,
        data: rows.map((r) => ({
            period: r.period,
            calls: r.calls,
            distributions: r.distributions,
            netCashflow: r.netCashflow ?? (r.distributions - r.calls),
        })),
        xKey: 'period',
        series: [
            { key: 'calls', label: 'Calls', type: 'bar', color: '#ef4444' },
            { key: 'distributions', label: 'Distributions', type: 'bar', color: '#22c55e' },
            { key: 'netCashflow', label: 'Net Cashflow', type: 'line', color: '#0ea5e9', yAxisId: 'right', dot: false },
        ],
        yAxis: { left: { label: 'Amount' }, right: { label: 'Net' } },
        options: { stacked: false, referenceZero: true, collapseInitially },
    };
    return spec;
}

/**
 * Build a multi-line performance chart (TVPI/DPI/RVPI)
 */
export function buildPerformanceLineChart(params: {
    title?: string;
    description?: string;
    rows: Array<{
        period: string;
        tvpi?: number;
        dpi?: number;
        rvpi?: number;
    }>;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, description, rows, collapseInitially } = params;
    const data = rows.map((r) => ({
        period: r.period,
        tvpi: r.tvpi ?? null,
        dpi: r.dpi ?? null,
        rvpi: r.rvpi ?? null,
    }));
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'line',
        title: title || 'Performance (J‑Curve)',
        description,
        data,
        xKey: 'period',
        series: [
            { key: 'tvpi', label: 'TVPI', type: 'line', color: '#4f46e5', dot: false },
            { key: 'dpi', label: 'DPI', type: 'line', color: '#16a34a', dot: false },
            { key: 'rvpi', label: 'RVPI', type: 'line', color: '#f59e0b', dot: false },
        ],
        yAxis: { left: { label: 'Multiple (x)' } },
        options: { stacked: false, referenceZero: true, collapseInitially },
    };
    return spec;
}

/**
 * Build a TVPI-only overlay chart (two series, e.g., left vs right scenario)
 */
export function buildTvpiOverlayChart(params: {
    title?: string;
    description?: string;
    rows: Array<{ period: string; tvpi_left?: number; tvpi_right?: number }>;
    leftLabel: string;
    rightLabel: string;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, description, rows, leftLabel, rightLabel, collapseInitially } = params;
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'line',
        title: title || 'TVPI Over Time',
        description,
        data: rows,
        xKey: 'period',
        series: [
            { key: 'tvpi_left', label: `TVPI – ${leftLabel}`, type: 'line', color: '#4f46e5', dot: false },
            { key: 'tvpi_right', label: `TVPI – ${rightLabel}`, type: 'line', color: '#6366f1', dot: false },
        ],
        yAxis: { left: { label: 'Multiple (x)' } },
        options: { stacked: false, referenceZero: true, collapseInitially },
    };
    return spec;
}

/**
 * Build a NAV over time line chart (single line, right or left axis)
 */
export function buildNavLineChart(params: {
    title?: string;
    description?: string;
    rows: Array<{ period: string; nav: number }>;
    collapseInitially?: boolean;
}): ChartSpecV1 {
    const { title, description, rows, collapseInitially } = params;
    const spec: ChartSpecV1 = {
        version: '1.0',
        library: 'recharts',
        chart: 'line',
        title: title || 'NAV Over Time',
        description,
        data: rows.map(r => ({ period: r.period, nav: r.nav })),
        xKey: 'period',
        series: [
            { key: 'nav', label: 'NAV', type: 'line', color: '#0ea5e9', dot: false },
        ],
        yAxis: { left: { label: 'NAV' } },
        options: { stacked: false, referenceZero: true, collapseInitially },
    };
    return spec;
}
