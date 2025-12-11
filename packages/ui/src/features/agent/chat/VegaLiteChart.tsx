import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { VegaLite, type VisualizationSpec } from 'react-vega';
import type { View } from 'vega';
import type { VegaLiteChartSpec } from './AgentChart';

type VegaLiteChartProps = {
    spec: VegaLiteChartSpec;
};

// Error display component
function VegaErrorDisplay({ error, chartTitle }: { error: string; chartTitle?: string }) {
    return (
        <div className="flex items-center justify-center h-full bg-red-50 dark:bg-red-950 rounded-md p-4">
            <div className="text-center">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    Cannot render {chartTitle || 'Vega-Lite'} chart
                </p>
                <p className="text-xs text-red-500 dark:text-red-500 mt-1 max-w-xs truncate">
                    {error}
                </p>
            </div>
        </div>
    );
}

export const VegaLiteChart = memo(function VegaLiteChart({ spec }: VegaLiteChartProps) {
    const { title, description, spec: vegaSpec, options } = spec;
    const [isExporting, setIsExporting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const viewRef = useRef<View | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build the full Vega-Lite spec with defaults
    // Note: Using 'as any' for width because 'container' is valid in Vega-Lite but not in the TypeScript types
    const fullSpec: VisualizationSpec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container' as unknown as number,
        height: 250,
        ...vegaSpec,
        // Override title if provided at top level
        ...(title && !vegaSpec.title ? { title } : {}),
        // Apply transparent background for dark mode compatibility
        config: {
            background: 'transparent',
            view: { stroke: 'transparent' },
            axis: {
                labelColor: '#6b7280',
                titleColor: '#374151',
                gridColor: '#e5e7eb',
            },
            legend: {
                labelColor: '#6b7280',
                titleColor: '#374151',
            },
            title: {
                color: '#111827',
            },
            ...vegaSpec.config,
        },
    };

    const handleCopy = useCallback(async () => {
        if (!viewRef.current || isCopied) return;

        try {
            const canvas = await viewRef.current.toCanvas(2);
            canvas.toBlob(async (blob: Blob | null) => {
                if (blob) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                }
            }, 'image/png');
        } catch (err) {
            console.error('Failed to copy chart:', err);
        }
    }, [isCopied]);

    const handleExport = useCallback(async () => {
        if (!viewRef.current || isExporting) return;

        setIsExporting(true);
        try {
            const url = await viewRef.current.toImageURL('png', 2);
            const link = document.createElement('a');
            link.download = `${title || 'chart'}.png`;
            link.href = url;
            link.click();
        } catch (err) {
            console.error('Failed to export chart:', err);
        } finally {
            setIsExporting(false);
        }
    }, [title, isExporting]);

    const handleNewView = useCallback((view: View) => {
        viewRef.current = view;
        setError(null);
    }, []);

    const handleError = useCallback((err: Error) => {
        console.error('Vega-Lite rendering error:', err);
        setError(err.message || 'Unknown error');
    }, []);

    // Clear error when spec changes
    useEffect(() => {
        setError(null);
    }, [vegaSpec]);

    if (error) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {title || 'Chart'}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                        <VegaErrorDisplay error={error} chartTitle={title} />
                    </div>
                </div>
            </div>
        );
    }

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
                <div
                    ref={containerRef}
                    className="bg-white dark:bg-gray-900 rounded overflow-hidden"
                    style={{ width: '100%', height: 280, minWidth: 0 }}
                >
                    <VegaLite
                        spec={fullSpec}
                        onNewView={handleNewView}
                        onError={handleError}
                        renderer={options?.renderer || 'canvas'}
                        actions={false}
                    />
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Deep compare the spec to prevent re-renders when data hasn't changed
    return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
});
