import { useState } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    LineChart,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';

export type AgentChartSpec = {
    version?: '1.0';
    library?: 'recharts';
    chart: 'bar' | 'line' | 'composed';
    title?: string;
    description?: string;
    data: Record<string, any>[];
    xKey: string;
    series: Array<{
        key: string;
        label?: string;
        type?: 'bar' | 'line';
        color?: string;
        yAxisId?: 'left' | 'right';
        stackId?: string;
        dot?: boolean;
    }>;
    yAxis?: {
        left?: { label?: string };
        right?: { label?: string };
    };
    options?: {
        stacked?: boolean;
        referenceZero?: boolean;
        collapsible?: boolean;
        collapseInitially?: boolean;
    };
};

type AgentChartProps = {
    spec: AgentChartSpec;
};

function formatNumber(n: number): string {
    if (!isFinite(n)) return String(n);
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

export function AgentChart({ spec }: AgentChartProps) {
    const {
        chart,
        title,
        description,
        data,
        xKey,
        series,
        yAxis,
        options,
    } = spec;
    const [collapsed, setCollapsed] = useState<boolean>(options?.collapseInitially ?? false);

    const commonAxes = (
        <>
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis
                yAxisId="left"
                tickFormatter={formatNumber}
                label={yAxis?.left?.label ? { value: yAxis.left.label, angle: -90, position: 'insideLeft' } : undefined}
            />
            {series.some((s) => s.yAxisId === 'right') && (
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatNumber}
                    label={yAxis?.right?.label ? { value: yAxis.right.label, angle: -90, position: 'insideRight' } : undefined}
                />
            )}
        </>
    );

    const commonOverlays = (
        <>
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
            <Legend />
            {options?.referenceZero && <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />}
        </>
    );

    const renderSeries = () =>
        series.map((s, idx) => {
            const color = s.color || ['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'][idx % 5];
            const yAxisId = s.yAxisId || 'left';
            if (chart === 'line') {
                return (
                    <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label || s.key}
                        stroke={color}
                        dot={s.dot ?? false}
                        yAxisId={yAxisId}
                    />
                );
            }
            if (chart === 'bar' || s.type === 'bar') {
                return (
                    <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label || s.key}
                        fill={color}
                        stackId={options?.stacked ? (s.stackId || 'stack') : undefined}
                        yAxisId={yAxisId}
                    />
                );
            }
            // default to line in composed
            return (
                <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label || s.key}
                    stroke={color}
                    dot={s.dot ?? false}
                    yAxisId={yAxisId}
                />
            );
        });

    const isCollapsible = options?.collapsible !== false; // default true

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col gap-2 p-3">
                {(title || isCollapsible) && (
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {title || 'Chart'}
                        </span>
                        {isCollapsible && (
                            <button
                                onClick={() => setCollapsed(!collapsed)}
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            >
                                {collapsed ? 'Show' : 'Hide'}
                            </button>
                        )}
                    </div>
                )}
                {description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {description}
                    </span>
                )}
                {!collapsed && (
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            {chart === 'bar' ? (
                                <BarChart data={data}>
                                    {commonAxes}
                                    {commonOverlays}
                                    {renderSeries()}
                                </BarChart>
                            ) : chart === 'line' ? (
                                <LineChart data={data}>
                                    {commonAxes}
                                    {commonOverlays}
                                    {renderSeries()}
                                </LineChart>
                            ) : (
                                <ComposedChart data={data}>
                                    {commonAxes}
                                    {commonOverlays}
                                    {renderSeries()}
                                </ComposedChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
