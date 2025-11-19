/**
 * AgentChart component - Renders charts from agent tool outputs
 *
 * This component provides a lightweight chart rendering system without external dependencies.
 * It supports bar, line, and composed charts using SVG.
 */

import { useState } from "react";

export type AgentChartSpec = {
    version?: '1.0';
    library?: 'simple' | 'recharts';
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
        options,
    } = spec;
    const [collapsed, setCollapsed] = useState<boolean>(options?.collapseInitially ?? false);

    const isCollapsible = options?.collapsible !== false; // default true

    // Calculate min/max for scaling
    const allValues: number[] = [];
    data.forEach(item => {
        series.forEach(s => {
            const val = item[s.key];
            if (typeof val === 'number' && isFinite(val)) {
                allValues.push(val);
            }
        });
    });

    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(0, ...allValues);
    const range = maxValue - minValue || 1;

    const chartHeight = 280;
    //const chartWidth = 100; // percentage
    const padding = { top: 20, right: 40, bottom: 40, left: 60 };

    // Color palette
    const colors = ['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

    // Render simple SVG chart
    const renderChart = () => {
        if (!data.length) {
            return (
                <div className="flex items-center justify-center h-full text-sm text-muted">
                    No data available
                </div>
            );
        }

        const dataPoints = data.length;
        const barWidth = (100 / dataPoints) * 0.8; // 80% of available space per data point

        return (
            <div style={{ width: '100%', height: chartHeight, position: 'relative' }}>
                <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 1000 ${chartHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{ overflow: 'visible' }}
                >
                    {/* Grid lines */}
                    <g className="grid">
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const y = padding.top + (chartHeight - padding.top - padding.bottom) * ratio;
                            const value = maxValue - (range * ratio);
                            return (
                                <g key={i}>
                                    <line
                                        x1={padding.left}
                                        y1={y}
                                        x2={1000 - padding.right}
                                        y2={y}
                                        stroke="#e5e7eb"
                                        strokeDasharray="3,3"
                                    />
                                    <text
                                        x={padding.left - 10}
                                        y={y}
                                        textAnchor="end"
                                        alignmentBaseline="middle"
                                        fontSize="10"
                                        fill="#6b7280"
                                    >
                                        {formatNumber(value)}
                                    </text>
                                </g>
                            );
                        })}
                    </g>

                    {/* Zero reference line */}
                    {options?.referenceZero && minValue < 0 && (
                        <line
                            x1={padding.left}
                            y1={padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - 0) / range)}
                            x2={1000 - padding.right}
                            y2={padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - 0) / range)}
                            stroke="#999"
                            strokeDasharray="3,3"
                        />
                    )}

                    {/* Data rendering */}
                    {series.map((s, seriesIdx) => {
                        const color = s.color || colors[seriesIdx % colors.length];
                        const isBar = chart === 'bar' || s.type === 'bar';

                        if (isBar) {
                            return data.map((item, dataIdx) => {
                                const value = item[s.key];
                                if (typeof value !== 'number' || !isFinite(value)) return null;

                                const x = padding.left + (dataIdx / dataPoints) * (1000 - padding.left - padding.right) + (seriesIdx * (barWidth / series.length) * 10);
                                const height = Math.abs(value / range) * (chartHeight - padding.top - padding.bottom);
                                const y = value >= 0
                                    ? padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - value) / range)
                                    : padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - 0) / range);

                                return (
                                    <g key={`${seriesIdx}-${dataIdx}`}>
                                        <rect
                                            x={x}
                                            y={y}
                                            width={(barWidth / series.length) * 10}
                                            height={height}
                                            fill={color}
                                            opacity={0.8}
                                        />
                                        <title>{`${item[xKey]}: ${formatNumber(value)}`}</title>
                                    </g>
                                );
                            });
                        } else {
                            // Line chart
                            const points = data
                                .map((item, dataIdx) => {
                                    const value = item[s.key];
                                    if (typeof value !== 'number' || !isFinite(value)) return null;

                                    const x = padding.left + (dataIdx / (dataPoints - 1)) * (1000 - padding.left - padding.right);
                                    const y = padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - value) / range);
                                    return `${x},${y}`;
                                })
                                .filter(Boolean);

                            return (
                                <g key={seriesIdx}>
                                    <polyline
                                        points={points.join(' ')}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="2"
                                    />
                                    {s.dot !== false && data.map((item, dataIdx) => {
                                        const value = item[s.key];
                                        if (typeof value !== 'number' || !isFinite(value)) return null;

                                        const x = padding.left + (dataIdx / (dataPoints - 1)) * (1000 - padding.left - padding.right);
                                        const y = padding.top + (chartHeight - padding.top - padding.bottom) * ((maxValue - value) / range);

                                        return (
                                            <circle
                                                key={dataIdx}
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill={color}
                                            >
                                                <title>{`${item[xKey]}: ${formatNumber(value)}`}</title>
                                            </circle>
                                        );
                                    })}
                                </g>
                            );
                        }
                    })}

                    {/* X-axis labels */}
                    {data.map((item, idx) => {
                        const x = padding.left + (idx / dataPoints) * (1000 - padding.left - padding.right) + (barWidth * 10 / 2);
                        return (
                            <text
                                key={idx}
                                x={x}
                                y={chartHeight - padding.bottom + 20}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#6b7280"
                            >
                                {String(item[xKey]).substring(0, 10)}
                            </text>
                        );
                    })}
                </svg>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {series.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs text-muted">
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    backgroundColor: s.color || colors[idx % colors.length],
                                    borderRadius: 2,
                                }}
                            />
                            <span>{s.label || s.key}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="border border-muted/30 bg-white dark:bg-gray-900 shadow-sm overflow-hidden mb-3">
            <div className="p-3">
                {(title || isCollapsible) && (
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{title || 'Chart'}</div>
                        {isCollapsible && (
                            <button
                                onClick={() => setCollapsed(!collapsed)}
                                className="text-xs px-2 py-1 rounded border border-muted/40 bg-muted/10 hover:bg-muted/20 cursor-pointer"
                            >
                                {collapsed ? 'Show' : 'Hide'}
                            </button>
                        )}
                    </div>
                )}
                {description && (
                    <div className="text-xs text-muted mb-2">{description}</div>
                )}
                {!collapsed && renderChart()}
            </div>
        </div>
    );
}
