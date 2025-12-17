import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Download, Copy, Check, Maximize2, Minimize2, X } from 'lucide-react';
import { VegaLite, type VisualizationSpec } from 'react-vega';
import type { View } from 'vega';
import type { VegaLiteChartSpec } from './AgentChart';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../../core/components/libs/utils';

type VegaLiteChartProps = {
    spec: VegaLiteChartSpec;
};

// Constants
const DEFAULT_CHART_HEIGHT = 280;
const DEFAULT_DASHBOARD_HEIGHT = 500;

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

// Fullscreen dialog component
function FullscreenDialog({
    isOpen,
    onClose,
    title,
    description,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                />
                <DialogPrimitive.Content
                    className="fixed inset-4 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    onEscapeKeyDown={onClose}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex flex-col">
                            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {title || 'Dashboard'}
                            </DialogPrimitive.Title>
                            {description && (
                                <DialogPrimitive.Description className="text-sm text-gray-500 dark:text-gray-400">
                                    {description}
                                </DialogPrimitive.Description>
                            )}
                        </div>
                        <DialogPrimitive.Close asChild>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                aria-label="Close fullscreen"
                            >
                                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </DialogPrimitive.Close>
                    </div>
                    {/* Content */}
                    <div className="flex-1 overflow-auto p-4">
                        {children}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

// Calculate height based on spec complexity
function calculateAutoHeight(spec: Record<string, any>, mode: 'chart' | 'dashboard'): number {
    if (mode === 'chart') {
        return DEFAULT_CHART_HEIGHT;
    }

    // For dashboard mode, try to calculate based on spec structure
    let rowCount = 1;

    if (spec.vconcat) {
        rowCount = Array.isArray(spec.vconcat) ? spec.vconcat.length : 1;
    } else if (spec.concat) {
        const columns = spec.columns || 2;
        const items = Array.isArray(spec.concat) ? spec.concat.length : 1;
        rowCount = Math.ceil(items / columns);
    } else if (spec.facet) {
        // Faceted charts - estimate based on data
        rowCount = 2; // Default estimate
    }

    // Base height per row + padding
    return Math.max(DEFAULT_DASHBOARD_HEIGHT, rowCount * 280 + 40);
}

// Get dark mode config for Vega
function getDarkModeConfig(isDark: boolean): Record<string, any> {
    if (isDark) {
        return {
            background: 'transparent',
            view: { stroke: 'transparent' },
            axis: {
                labelColor: '#9ca3af',
                titleColor: '#d1d5db',
                gridColor: '#374151',
                domainColor: '#4b5563',
                tickColor: '#4b5563',
            },
            legend: {
                labelColor: '#9ca3af',
                titleColor: '#d1d5db',
            },
            title: {
                color: '#f3f4f6',
            },
        };
    }
    return {
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
    };
}

export const VegaLiteChart = memo(function VegaLiteChart({ spec }: VegaLiteChartProps) {
    const { title, description, spec: vegaSpec, options } = spec;
    const [isExporting, setIsExporting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const viewRef = useRef<View | null>(null);
    const fullscreenViewRef = useRef<View | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Determine mode and settings
    const mode = options?.mode || 'chart';
    const isDashboard = mode === 'dashboard';
    const showFullscreenButton = options?.enableFullscreen ?? isDashboard;

    // Calculate height
    const baseHeight = options?.height || calculateAutoHeight(vegaSpec, mode);

    // Detect dark mode
    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Track container width for responsive sizing
    const [containerWidth, setContainerWidth] = useState(0);
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(containerRef.current);
        // Initial width
        setContainerWidth(containerRef.current.clientWidth);
        return () => resizeObserver.disconnect();
    }, []);

    // Build the full Vega-Lite spec with defaults
    const buildFullSpec = useCallback((height: number, forFullscreen = false): VisualizationSpec => {
        const config = getDarkModeConfig(isDarkMode);
        // Use measured container width, or fallback to a reasonable default
        const width = forFullscreen ? undefined : (containerWidth > 0 ? containerWidth - 24 : 500);

        return {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            ...(width ? { width } : {}),
            height: forFullscreen ? undefined : height,
            autosize: { type: 'fit', contains: 'padding' },
            ...vegaSpec,
            // Override title if provided at top level
            ...(title && !vegaSpec.title ? { title } : {}),
            // Apply theme config
            config: {
                ...config,
                ...vegaSpec.config,
            },
        };
    }, [vegaSpec, title, isDarkMode, containerWidth]);

    const handleCopy = useCallback(async () => {
        const view = isFullscreen ? fullscreenViewRef.current : viewRef.current;
        if (!view || isCopied) return;

        try {
            const canvas = await view.toCanvas(2);
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
    }, [isCopied, isFullscreen]);

    const handleExport = useCallback(async () => {
        const view = isFullscreen ? fullscreenViewRef.current : viewRef.current;
        if (!view || isExporting) return;

        setIsExporting(true);
        try {
            const url = await view.toImageURL('png', 2);
            const link = document.createElement('a');
            link.download = `${title || 'chart'}.png`;
            link.href = url;
            link.click();
        } catch (err) {
            console.error('Failed to export chart:', err);
        } finally {
            setIsExporting(false);
        }
    }, [title, isExporting, isFullscreen]);

    const handleNewView = useCallback((view: View) => {
        viewRef.current = view;
        setError(null);
    }, []);

    const handleFullscreenNewView = useCallback((view: View) => {
        fullscreenViewRef.current = view;
    }, []);

    const handleError = useCallback((err: Error) => {
        console.error('Vega-Lite rendering error:', err);
        setError(err.message || 'Unknown error');
    }, []);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => !prev);
    }, []);

    // Clear error when spec changes
    useEffect(() => {
        setError(null);
    }, [vegaSpec]);

    // Toolbar component (reused in both views)
    const Toolbar = ({ className }: { className?: string }) => (
        <div className={cn("flex items-center gap-2", className)}>
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
            {showFullscreenButton && (
                <button
                    onClick={toggleFullscreen}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center gap-1"
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    {isFullscreen ? 'Exit' : 'Fullscreen'}
                </button>
            )}
        </div>
    );

    if (error) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {title || 'Chart'}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: baseHeight }}>
                        <VegaErrorDisplay error={error} chartTitle={title} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main chart container */}
            <div className={cn(
                "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm",
                isDashboard && "border-2"
            )}>
                <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {title || (isDashboard ? 'Dashboard' : 'Chart')}
                            </span>
                            {isDashboard && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                                    Interactive
                                </span>
                            )}
                        </div>
                        <Toolbar />
                    </div>
                    {description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {description}
                        </span>
                    )}
                    <div
                        ref={containerRef}
                        className="bg-white dark:bg-gray-900 rounded overflow-hidden"
                        style={{ width: '100%', height: baseHeight, minWidth: 0 }}
                    >
                        <VegaLite
                            spec={buildFullSpec(baseHeight)}
                            onNewView={handleNewView}
                            onError={handleError}
                            renderer={options?.renderer || 'canvas'}
                            actions={false}
                        />
                    </div>
                </div>
            </div>

            {/* Fullscreen dialog */}
            <FullscreenDialog
                isOpen={isFullscreen}
                onClose={() => setIsFullscreen(false)}
                title={title || (isDashboard ? 'Dashboard' : 'Chart')}
                description={description}
            >
                <div className="w-full h-full min-h-[calc(100vh-200px)]">
                    <VegaLite
                        spec={buildFullSpec(0, true)}
                        onNewView={handleFullscreenNewView}
                        onError={handleError}
                        renderer={options?.renderer || 'canvas'}
                        actions={false}
                    />
                </div>
                {/* Floating toolbar in fullscreen */}
                <div className="absolute bottom-6 right-6">
                    <Toolbar className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700" />
                </div>
            </FullscreenDialog>
        </>
    );
}, (prevProps, nextProps) => {
    // Deep compare the spec to prevent re-renders when data hasn't changed
    return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec);
});
