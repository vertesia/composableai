import { Component, memo, useState, useRef, useCallback, type ReactNode, type ErrorInfo } from 'react';
import { toPng } from 'html-to-image';
import { Download, Copy, Check } from 'lucide-react';
import { VegaLiteChart } from './VegaLiteChart';
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

// Error boundary for chart rendering
type ChartErrorBoundaryProps = {
    chartType: string;
    children: ReactNode;
};

type ChartErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};

class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
    constructor(props: ChartErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Chart rendering error (${this.props.chartType}):`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-full bg-red-50 dark:bg-red-950 rounded-md p-4">
                    <div className="text-center">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            Cannot render {this.props.chartType} chart
                        </p>
                        <p className="text-xs text-red-500 dark:text-red-500 mt-1 max-w-xs truncate">
                            {this.state.error?.message || 'Unknown error'}
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Recharts-based chart specification (default)
export type RechartsChartSpec = {
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

// Vega-Lite chart specification for advanced visualizations
export type VegaLiteChartSpec = {
    version?: '1.0';
    library: 'vega-lite';
    title?: string;
    description?: string;
    // Native Vega-Lite specification object
    spec: Record<string, any>;
    options?: {
        collapsible?: boolean;
        collapseInitially?: boolean;
        theme?: 'default' | 'dark';
        renderer?: 'canvas' | 'svg';
    };
};

// Union type for all chart specifications
export type AgentChartSpec = RechartsChartSpec | VegaLiteChartSpec;

// Type guard to check if spec is Vega-Lite
export function isVegaLiteSpec(spec: AgentChartSpec): spec is VegaLiteChartSpec {
    return spec.library === 'vega-lite';
}

// Type guard to check if spec is Recharts (default)
export function isRechartsSpec(spec: AgentChartSpec): spec is RechartsChartSpec {
    return spec.library === 'recharts' || spec.library === undefined;
}

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

// Router component that delegates to the appropriate chart renderer
export const AgentChart = memo(function AgentChart({ spec }: AgentChartProps) {
    // Route to VegaLiteChart for Vega-Lite specs
    if (isVegaLiteSpec(spec)) {
        return <VegaLiteChart spec={spec} />;
    }

    // Route to RechartsChart for Recharts specs
    return <RechartsChart spec={spec as RechartsChartSpec} />;
}, (prevProps, nextProps) => {
    // Deep compare the spec to prevent re-renders when data hasn't changed
    return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
});

// Recharts implementation component
const RechartsChart = memo(function RechartsChart({ spec }: { spec: RechartsChartSpec }) {
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
    const [isExporting, setIsExporting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const handleCopy = useCallback(async () => {
        if (!chartRef.current || isCopied) return;

        try {
            const dataUrl = await toPng(chartRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
            });
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy chart:', err);
        }
    }, [isCopied]);

    const handleExport = useCallback(async () => {
        if (!chartRef.current || isExporting) return;

        setIsExporting(true);
        try {
            const dataUrl = await toPng(chartRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
            });
            const link = document.createElement('a');
            link.download = `${title || 'chart'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export chart:', err);
        } finally {
            setIsExporting(false);
        }
    }, [title, isExporting]);

    // Safe arrays - default to empty array if undefined
    const safeSeries = series || [];
    const safeData = data || [];

    const commonAxes = (
        <>
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis
                yAxisId="left"
                tickFormatter={formatNumber}
                label={yAxis?.left?.label ? { value: yAxis.left.label, angle: -90, position: 'insideLeft' } : undefined}
            />
            {safeSeries.some((s) => s.yAxisId === 'right') && (
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
        safeSeries.map((s, idx) => {
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
                    data={safeData}
                    dataKey={vKey}
                    nameKey={nKey}
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={100}
                    label={options?.showLabels !== false}
                >
                    {safeData.map((_, index) => (
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
                {safeSeries.length > 0 ? (
                    safeSeries.map((s, idx) => (
                        <Scatter
                            key={s.key}
                            name={s.label || s.key}
                            data={safeData}
                            fill={s.color || COLORS[idx % COLORS.length]}
                        />
                    ))
                ) : (
                    <Scatter name="Data" data={safeData} fill={COLORS[0]} />
                )}
            </ScatterChart>
        );
    };

    // Render Radar Chart
    const renderRadarChart = () => {
        const aKey = axisKey || xKey || 'axis';
        return (
            <RadarChart cx="50%" cy="50%" outerRadius={100} data={safeData}>
                <PolarGrid />
                <PolarAngleAxis dataKey={aKey} tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tickFormatter={formatNumber} />
                {safeSeries.map((s, idx) => (
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
                data={safeData}
                startAngle={startAngle}
                endAngle={endAngle}
            >
                <RadialBar
                    label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }}
                    background
                    dataKey={vKey}
                >
                    {safeData.map((_, index) => (
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
                        const item = safeData.find((d) => d[nKey] === value || d[vKey] === entry.payload?.value);
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
                <Funnel dataKey={vKey} data={safeData} isAnimationActive>
                    {safeData.map((_, index) => (
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
                data={safeData}
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
                    <BarChart data={safeData}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </BarChart>
                );
            case 'line':
                return (
                    <LineChart data={safeData}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </LineChart>
                );
            case 'area':
                return (
                    <AreaChart data={safeData}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </AreaChart>
                );
            case 'composed':
                return (
                    <ComposedChart data={safeData}>
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
                    <ComposedChart data={safeData}>
                        {commonAxes}
                        {commonOverlays}
                        {renderSeries()}
                    </ComposedChart>
                );
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {title || 'Chart'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            disabled={isCopied}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                            title="Copy to clipboard"
                        >
                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {isCopied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Export as PNG"
                        >
                            <Download className="w-3 h-3" />
                            {isExporting ? 'Exporting...' : 'Export'}
                        </button>
                    </div>
                </div>
                {description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {description}
                    </span>
                )}
                <div ref={chartRef} className="bg-white dark:bg-gray-900 rounded" style={{ width: '100%', height: 280, minWidth: 0 }}>
                    <ChartErrorBoundary chartType={chart}>
                        <ResponsiveContainer width="100%" height="100%">
                            {renderChart()}
                        </ResponsiveContainer>
                    </ChartErrorBoundary>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Deep compare the spec to prevent re-renders when data hasn't changed
    return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
});
