import { useState } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    LineChart,
    ComposedChart,
    AreaChart,
    PieChart,
    ScatterChart,
    RadarChart,
    RadialBarChart,
    FunnelChart,
    Treemap,
    Bar,
    Line,
    Area,
    Pie,
    Cell,
    Scatter,
    Radar,
    RadialBar,
    Funnel,
    LabelList,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';

// Default color palette for charts
const COLORS = ['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export type AgentChartSpec = {
    version?: '1.0';
    library?: 'recharts';
    chart: 'bar' | 'line' | 'composed' | 'area' | 'pie' | 'scatter' | 'radar' | 'radialBar' | 'funnel' | 'treemap';
    title?: string;
    description?: string;
    data: Record<string, any>[];
    xKey: string;
    series: Array<{
        key: string;
        label?: string;
        type?: 'bar' | 'line' | 'area';
        color?: string;
        yAxisId?: 'left' | 'right';
        stackId?: string;
        dot?: boolean;
    }>;
    // For pie/radialBar charts
    nameKey?: string;
    valueKey?: string;
    // For scatter charts
    yKey?: string;
    zKey?: string; // optional size dimension
    // For radar charts
    axisKey?: string;
    // For treemap
    dataKey?: string;
    yAxis?: {
        left?: { label?: string };
        right?: { label?: string };
    };
    options?: {
        stacked?: boolean;
        referenceZero?: boolean;
        collapsible?: boolean;
        collapseInitially?: boolean;
        innerRadius?: number; // for pie/radialBar (donut style)
        showLabels?: boolean; // for pie/funnel
        startAngle?: number; // for radialBar
        endAngle?: number; // for radialBar
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
        nameKey,
        valueKey,
        yKey,
        zKey: _zKey,
        axisKey,
        dataKey,
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
            const color = s.color || COLORS[idx % COLORS.length];
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
            if (chart === 'area') {
                return (
                    <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label || s.key}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.3}
                        stackId={options?.stacked ? (s.stackId || 'stack') : undefined}
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
            if (s.type === 'area') {
                return (
                    <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label || s.key}
                        stroke={color}
                        fill={color}
                        fillOpacity={0.3}
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

    // Render Pie Chart
    const renderPieChart = () => {
        const nKey = nameKey || 'name';
        const vKey = valueKey || 'value';
        const innerRadius = options?.innerRadius || 0;
        return (
            <PieChart>
                <Pie
                    data={data}
                    dataKey={vKey}
                    nameKey={nKey}
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={100}
                    label={options?.showLabels !== false}
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
                <Legend />
            </PieChart>
        );
    };

    // Render Scatter Chart
    const renderScatterChart = () => {
        const xDataKey = xKey;
        const yDataKey = yKey || 'y';
        return (
            <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xDataKey} name={xDataKey} tick={{ fontSize: 12 }} />
                <YAxis dataKey={yDataKey} name={yDataKey} tickFormatter={formatNumber} />
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
                <Legend />
                {series.length > 0 ? (
                    series.map((s, idx) => (
                        <Scatter
                            key={s.key}
                            name={s.label || s.key}
                            data={data}
                            fill={s.color || COLORS[idx % COLORS.length]}
                        />
                    ))
                ) : (
                    <Scatter name="Data" data={data} fill={COLORS[0]} />
                )}
            </ScatterChart>
        );
    };

    // Render Radar Chart
    const renderRadarChart = () => {
        const aKey = axisKey || xKey || 'axis';
        return (
            <RadarChart cx="50%" cy="50%" outerRadius={100} data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey={aKey} tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tickFormatter={formatNumber} />
                {series.map((s, idx) => (
                    <Radar
                        key={s.key}
                        name={s.label || s.key}
                        dataKey={s.key}
                        stroke={s.color || COLORS[idx % COLORS.length]}
                        fill={s.color || COLORS[idx % COLORS.length]}
                        fillOpacity={0.3}
                    />
                ))}
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
                <Legend />
            </RadarChart>
        );
    };

    // Render RadialBar Chart
    const renderRadialBarChart = () => {
        const nKey = nameKey || 'name';
        const vKey = valueKey || 'value';
        const startAngle = options?.startAngle ?? 180;
        const endAngle = options?.endAngle ?? 0;
        const innerRadius = options?.innerRadius ?? 30;
        return (
            <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={100}
                barSize={15}
                data={data}
                startAngle={startAngle}
                endAngle={endAngle}
            >
                <RadialBar
                    label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }}
                    background
                    dataKey={vKey}
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </RadialBar>
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
                <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    formatter={(value, entry) => {
                        const item = data.find((d) => d[nKey] === value || d[vKey] === entry.payload?.value);
                        return item ? item[nKey] : value;
                    }}
                />
            </RadialBarChart>
        );
    };

    // Render Funnel Chart
    const renderFunnelChart = () => {
        const nKey = nameKey || 'name';
        const vKey = valueKey || 'value';
        return (
            <FunnelChart>
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatNumber(value) : String(value))} />
                <Funnel dataKey={vKey} data={data} isAnimationActive>
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    {options?.showLabels !== false && (
                        <LabelList position="center" fill="#fff" stroke="none" dataKey={nKey} />
                    )}
                </Funnel>
            </FunnelChart>
        );
    };

    // Render Treemap
    const renderTreemap = () => {
        const dKey = dataKey || valueKey || 'value';
        return (
            <Treemap
                data={data}
                dataKey={dKey}
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#4f46e5"
                content={({ x, y, width, height, name, value, index }) => {
                    const fill = COLORS[(index as number) % COLORS.length];
                    return (
                        <g>
                            <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                style={{ fill, stroke: '#fff', strokeWidth: 2 }}
                            />
                            {(width as number) > 50 && (height as number) > 30 && (
                                <>
                                    <text
                                        x={(x as number) + (width as number) / 2}
                                        y={(y as number) + (height as number) / 2 - 7}
                                        textAnchor="middle"
                                        fill="#fff"
                                        fontSize={12}
                                    >
                                        {name}
                                    </text>
                                    <text
                                        x={(x as number) + (width as number) / 2}
                                        y={(y as number) + (height as number) / 2 + 10}
                                        textAnchor="middle"
                                        fill="#fff"
                                        fontSize={11}
                                    >
                                        {formatNumber(value as number)}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                }}
            />
        );
    };

    // Render chart based on type
    const renderChart = () => {
        switch (chart) {
            case 'bar':
                return (
                    <BarChart data={data}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </BarChart>
                );
            case 'line':
                return (
                    <LineChart data={data}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </LineChart>
                );
            case 'area':
                return (
                    <AreaChart data={data}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </AreaChart>
                );
            case 'composed':
                return (
                    <ComposedChart data={data}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </ComposedChart>
                );
            case 'pie':
                return renderPieChart();
            case 'scatter':
                return renderScatterChart();
            case 'radar':
                return renderRadarChart();
            case 'radialBar':
                return renderRadialBarChart();
            case 'funnel':
                return renderFunnelChart();
            case 'treemap':
                return renderTreemap();
            default:
                return (
                    <ComposedChart data={data}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </ComposedChart>
                );
        }
    };

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
                            {renderChart()}
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
