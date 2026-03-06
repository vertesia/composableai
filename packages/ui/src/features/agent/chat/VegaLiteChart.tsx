import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, Copy, Download, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import Papa from 'papaparse';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VegaEmbed } from 'react-vega';
import type { View } from 'vega';
import type { TopLevelSpec as VisualizationSpec } from 'vega-lite';
import { cn } from '../../../core/components/libs/utils';
import { useUserSession } from '@vertesia/ui/session';
import type { VegaLiteChartSpec } from './AgentChart';
import { getArtifactCacheKey, getFileCacheKey, useArtifactUrlCache } from './useArtifactUrlCache';

type VegaLiteChartProps = {
    spec: VegaLiteChartSpec;
    /**
     * Optional workflow run id used to resolve artifact: URLs in Vega-Lite data references.
     */
    artifactRunId?: string;
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

// Fullscreen dialog component with smooth animations
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
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                />
                <DialogPrimitive.Content
                    className="fixed inset-2 sm:inset-4 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl transition-all duration-300 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2"
                    onEscapeKeyDown={onClose}
                >
                    {/* Close button - top right corner */}
                    <DialogPrimitive.Close asChild>
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 shadow-sm"
                            aria-label="Close fullscreen"
                        >
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </button>
                    </DialogPrimitive.Close>
                    {/* Chart content first - takes most space */}
                    <div className="flex-1 overflow-auto p-4 sm:p-6 animate-in fade-in-0 duration-500 delay-150">
                        {children}
                    </div>
                    {/* Title bar at bottom */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl">
                        <div className="flex flex-col">
                            <DialogPrimitive.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                {title || 'Dashboard'}
                            </DialogPrimitive.Title>
                            {description && (
                                <DialogPrimitive.Description className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {description}
                                </DialogPrimitive.Description>
                            )}
                        </div>
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

// Modern color palette - vibrant but professional
const CHART_COLORS = {
    // Primary palette - vibrant gradients
    categorical: [
        '#6366f1', // indigo
        '#8b5cf6', // violet
        '#ec4899', // pink
        '#f43f5e', // rose
        '#f97316', // orange
        '#eab308', // yellow
        '#22c55e', // green
        '#14b8a6', // teal
        '#06b6d4', // cyan
        '#3b82f6', // blue
    ],
    // Sequential schemes
    blues: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
    purples: ['#f3e8ff', '#c4b5fd', '#8b5cf6', '#6d28d9', '#4c1d95'],
    greens: ['#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d'],
    // Diverging
    diverging: ['#ef4444', '#fca5a5', '#fef3c7', '#86efac', '#22c55e'],
};

// Helper types for artifact resolution
type ArtifactReference = {
    path: string[];  // Path to the data object in the spec
    artifactPath: string;  // The artifact path (without "artifact:" prefix)
};

/**
 * Preprocess a Vega-Lite spec to fix duplicate signal names that occur
 * when params with selections are used in vconcat/hconcat layouts.
 *
 * The issue: Vega-Lite creates internal signals like `paramName_tuple` for
 * point selections. When a param is defined at the root level of a vconcat/hconcat
 * spec, Vega-Lite's compiler creates duplicate signals when propagating the
 * selection to sub-views.
 *
 * Solution: Move selection params from the root level to the first sub-view
 * (where selections typically originate). Cross-view references are preserved
 * so that clicking in one view filters other views.
 */
function fixVegaLiteSelectionParams(spec: Record<string, any>): Record<string, any> {
    // Deep clone the spec to avoid mutations
    const result = JSON.parse(JSON.stringify(spec)) as Record<string, any>;

    // Check if this is a concatenated spec with root-level selection params
    const concatKeys = ['vconcat', 'hconcat', 'concat'];
    const hasConcatViews = concatKeys.some(key => Array.isArray(result[key]));

    if (!hasConcatViews) {
        // Not a concatenated spec, no special handling needed
        return result;
    }

    // Check for selection params at the root level
    const rootSelectionParams: Array<{ name: string; param: Record<string, any> }> = [];
    if (Array.isArray(result.params)) {
        for (const param of result.params) {
            if (param && typeof param === 'object' && param.name && param.select) {
                rootSelectionParams.push({ name: param.name, param });
            }
        }
    }

    if (rootSelectionParams.length === 0) {
        // No selection params at root level, no special handling needed
        return result;
    }

    // Strategy: Move the selection param to the first sub-view that has an
    // encoding field matching the selection. Keep cross-view references intact
    // so filtering works across views.

    for (const { name: paramName, param } of rootSelectionParams) {
        const selectFields = param.select?.fields || [];
        const hasLegendBinding = param.select?.bind === 'legend';

        // Find the concat array
        let concatArray: any[] | null = null;
        for (const key of concatKeys) {
            if (Array.isArray(result[key])) {
                concatArray = result[key];
                break;
            }
        }

        if (!concatArray || concatArray.length === 0) continue;

        // Find the first view that has the selection field in its encoding
        // This is typically where users click to make selections
        let targetViewIndex = 0;
        for (let i = 0; i < concatArray.length; i++) {
            const view = concatArray[i];
            if (viewHasField(view, selectFields) || (hasLegendBinding && viewHasColorEncoding(view, selectFields))) {
                targetViewIndex = i;
                break;
            }
        }

        // Move the param to the target view
        const targetView = concatArray[targetViewIndex];
        if (!targetView.params) {
            targetView.params = [];
        }
        targetView.params.push(param);

        // Remove the param from root level
        result.params = result.params.filter((p: any) => p.name !== paramName);

        // Cross-view references are kept intact - Vega-Lite handles signal
        // propagation from the view where the selection is defined to other views
    }

    // Clean up empty params array at root
    if (Array.isArray(result.params) && result.params.length === 0) {
        delete result.params;
    }

    return result;
}

/**
 * Apply parameter values to a Vega-Lite spec.
 * Updates the 'value' field of named params, allowing models to set
 * initial values for interactive controls (sliders, dropdowns, etc.).
 * @exported for testing
 */
export function applyParameterValues(
    spec: Record<string, any>,
    parameterValues: Record<string, any>
): Record<string, any> {
    if (!parameterValues || Object.keys(parameterValues).length === 0) {
        return spec;
    }

    const result = JSON.parse(JSON.stringify(spec)) as Record<string, any>;

    // Helper to update params in a view
    const updateParams = (params: any[]) => {
        for (const param of params) {
            if (param && typeof param === 'object' && param.name && param.name in parameterValues) {
                param.value = parameterValues[param.name];
            }
        }
    };

    // Update root-level params
    if (Array.isArray(result.params)) {
        updateParams(result.params);
    }

    // Update params in nested views (vconcat, hconcat, concat)
    const updateNestedViews = (views: any[]) => {
        if (!Array.isArray(views)) return;
        for (const view of views) {
            if (view && Array.isArray(view.params)) {
                updateParams(view.params);
            }
            // Recursively handle nested concatenations
            if (view.vconcat) updateNestedViews(view.vconcat);
            if (view.hconcat) updateNestedViews(view.hconcat);
            if (view.concat) updateNestedViews(view.concat);
            // Handle layers
            if (Array.isArray(view.layer)) {
                for (const layer of view.layer) {
                    if (layer && Array.isArray(layer.params)) {
                        updateParams(layer.params);
                    }
                }
            }
        }
    };

    if (result.vconcat) updateNestedViews(result.vconcat);
    if (result.hconcat) updateNestedViews(result.hconcat);
    if (result.concat) updateNestedViews(result.concat);
    if (Array.isArray(result.layer)) {
        for (const layer of result.layer) {
            if (layer && Array.isArray(layer.params)) {
                updateParams(layer.params);
            }
        }
    }

    return result;
}

/**
 * Check if a view has encoding using any of the specified fields.
 */
function viewHasField(view: Record<string, any>, fields: string[]): boolean {
    if (!view || !view.encoding) return false;

    for (const field of fields) {
        for (const channel of Object.values(view.encoding)) {
            if (channel && typeof channel === 'object' && (channel as any).field === field) {
                return true;
            }
        }
    }

    // Also check nested layers
    if (Array.isArray(view.layer)) {
        for (const layer of view.layer) {
            if (viewHasField(layer, fields)) return true;
        }
    }

    return false;
}

/**
 * Check if a view has color encoding using any of the specified fields.
 */
function viewHasColorEncoding(view: Record<string, any>, fields: string[]): boolean {
    if (!view) return false;

    const checkEncoding = (encoding: any): boolean => {
        if (!encoding) return false;
        const colorField = encoding.color?.field;
        return colorField && fields.includes(colorField);
    };

    if (checkEncoding(view.encoding)) return true;

    // Check nested layers
    if (Array.isArray(view.layer)) {
        for (const layer of view.layer) {
            if (checkEncoding(layer.encoding)) return true;
        }
    }

    return false;
}

/**
 * Walk the Vega-Lite spec and find all artifact: URL references in data.url fields.
 * Returns an array of references with their paths in the spec tree.
 */
function findArtifactReferences(spec: Record<string, any>, currentPath: string[] = []): ArtifactReference[] {
    const references: ArtifactReference[] = [];

    if (!spec || typeof spec !== 'object') {
        return references;
    }

    // Check if this object has a data.url that's an artifact reference
    if (spec.data && typeof spec.data === 'object') {
        const url = spec.data.url;
        if (typeof url === 'string' && url.startsWith('artifact:')) {
            references.push({
                path: [...currentPath, 'data'],
                artifactPath: url.replace(/^artifact:/, '').trim(),
            });
        }
    }

    // Recursively check nested objects (layer, vconcat, hconcat, concat, spec, etc.)
    const nestedKeys = ['layer', 'vconcat', 'hconcat', 'concat', 'spec', 'repeat', 'facet'];
    for (const key of nestedKeys) {
        if (key in spec) {
            const value = spec[key];
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    references.push(...findArtifactReferences(item, [...currentPath, key, String(index)]));
                });
            } else if (typeof value === 'object' && value !== null) {
                references.push(...findArtifactReferences(value, [...currentPath, key]));
            }
        }
    }

    return references;
}

/**
 * Deep clone and update the spec by replacing artifact URLs with resolved data values.
 */
function replaceArtifactData(
    spec: Record<string, any>,
    resolvedData: Map<string, any[]>
): Record<string, any> {
    const result = JSON.parse(JSON.stringify(spec)) as Record<string, any>;

    for (const [pathKey, data] of resolvedData) {
        const path = pathKey.split('.');
        let current: any = result;

        // Navigate to the parent of the data object
        for (let i = 0; i < path.length - 1; i++) {
            if (current[path[i]] === undefined) {
                break;
            }
            current = current[path[i]];
        }

        // Replace data.url with data.values
        const lastKey = path[path.length - 1];
        if (current[lastKey] && typeof current[lastKey] === 'object') {
            delete current[lastKey].url;
            current[lastKey].values = data;
        }
    }

    return result;
}

// Get dark mode config for Vega with enhanced styling
function getDarkModeConfig(isDark: boolean): Record<string, any> {
    const baseConfig = {
        background: 'transparent',
        view: { stroke: 'transparent' },
        // Modern color range
        range: {
            category: CHART_COLORS.categorical,
            diverging: CHART_COLORS.diverging,
            heatmap: CHART_COLORS.purples,
            ramp: CHART_COLORS.blues,
        },
        // Enable tooltips by default for all mark types with enhanced styling
        mark: { tooltip: true },
        bar: {
            tooltip: true,
            cornerRadiusTopLeft: 4,
            cornerRadiusTopRight: 4,
        },
        line: {
            tooltip: true,
            strokeWidth: 2.5,
            strokeCap: 'round',
        },
        point: {
            tooltip: true,
            size: 60,
            filled: true,
        },
        area: {
            tooltip: true,
            fillOpacity: 0.7,
            line: true,
        },
        rect: {
            tooltip: true,
            cornerRadius: 2,
        },
        arc: {
            tooltip: true,
            cornerRadius: 4,
        },
        circle: {
            tooltip: true,
            size: 80,
        },
    };

    if (isDark) {
        return {
            ...baseConfig,
            axis: {
                labelColor: '#a1a1aa',
                titleColor: '#e4e4e7',
                gridColor: '#3f3f46',
                domainColor: '#52525b',
                tickColor: '#52525b',
                labelFont: 'Inter, system-ui, sans-serif',
                titleFont: 'Inter, system-ui, sans-serif',
                labelFontSize: 11,
                titleFontSize: 12,
                titleFontWeight: 500,
            },
            legend: {
                labelColor: '#a1a1aa',
                titleColor: '#e4e4e7',
                labelFont: 'Inter, system-ui, sans-serif',
                titleFont: 'Inter, system-ui, sans-serif',
                labelFontSize: 11,
                titleFontSize: 12,
                symbolSize: 100,
            },
            title: {
                color: '#fafafa',
                font: 'Inter, system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 600,
            },
        };
    }
    return {
        ...baseConfig,
        axis: {
            labelColor: '#71717a',
            titleColor: '#3f3f46',
            gridColor: '#e4e4e7',
            domainColor: '#d4d4d8',
            tickColor: '#d4d4d8',
            labelFont: 'Inter, system-ui, sans-serif',
            titleFont: 'Inter, system-ui, sans-serif',
            labelFontSize: 11,
            titleFontSize: 12,
            titleFontWeight: 500,
        },
        legend: {
            labelColor: '#71717a',
            titleColor: '#3f3f46',
            labelFont: 'Inter, system-ui, sans-serif',
            titleFont: 'Inter, system-ui, sans-serif',
            labelFontSize: 11,
            titleFontSize: 12,
            symbolSize: 100,
        },
        title: {
            color: '#18181b',
            font: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 600,
        },
    };
}

export const VegaLiteChart = memo(function VegaLiteChart({ spec, artifactRunId }: VegaLiteChartProps) {
    const { title, description, spec: vegaSpec, options } = spec;
    const [isExporting, setIsExporting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const viewRef = useRef<View | null>(null);
    const fullscreenViewRef = useRef<View | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Artifact resolution state
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    // Use refs to avoid triggering effect re-runs when these stable values are accessed
    const clientRef = useRef(client);
    clientRef.current = client;
    const urlCacheRef = useRef(urlCache);
    urlCacheRef.current = urlCache;
    const [resolvedSpec, setResolvedSpec] = useState<Record<string, any> | null>(null);
    const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
    const [artifactError, setArtifactError] = useState<string | null>(null);

    // Determine mode and settings
    const mode = options?.mode || 'chart';
    const isDashboard = mode === 'dashboard';
    const showFullscreenButton = options?.enableFullscreen ?? isDashboard;

    // Calculate height
    const baseHeight = options?.height || calculateAutoHeight(vegaSpec, mode);

    // Resolve artifact URLs in the spec
    useEffect(() => {
        const references = findArtifactReferences(vegaSpec);

        // If no artifact references, use original spec
        if (references.length === 0) {
            setResolvedSpec(vegaSpec);
            setIsLoadingArtifacts(false);
            setArtifactError(null);
            return;
        }

        if (!artifactRunId) {
            console.warn('[VegaLiteChart] artifact references found but artifactRunId is missing!', {
                references: references.map(r => r.artifactPath),
                artifactRunId,
            });
        } else {
            console.info('[VegaLiteChart] resolving artifacts with runId:', artifactRunId, references.map(r => r.artifactPath));
        }

        let cancelled = false;
        setIsLoadingArtifacts(true);
        setArtifactError(null);

        const resolveArtifacts = async () => {
            const resolvedData = new Map<string, any[]>();
            const currentClient = clientRef.current;
            const currentUrlCache = urlCacheRef.current;

            for (const ref of references) {
                try {
                    const pathKey = ref.path.join('.');
                    let url: string;

                    // Determine if this is a shorthand path or full path
                    if (artifactRunId && !ref.artifactPath.startsWith('agents/')) {
                        // Shorthand path - use artifact API
                        const cacheKey = getArtifactCacheKey(artifactRunId, ref.artifactPath, 'inline');
                        if (currentUrlCache) {
                            url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                                const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, ref.artifactPath, 'inline');
                                return result.url;
                            });
                        } else {
                            const result = await currentClient.files.getArtifactDownloadUrl(artifactRunId, ref.artifactPath, 'inline');
                            url = result.url;
                        }
                    } else {
                        // Full path - use files API
                        const cacheKey = getFileCacheKey(ref.artifactPath);
                        if (currentUrlCache) {
                            url = await currentUrlCache.getOrFetch(cacheKey, async () => {
                                const result = await currentClient.files.getDownloadUrl(ref.artifactPath);
                                return result.url;
                            });
                        } else {
                            const result = await currentClient.files.getDownloadUrl(ref.artifactPath);
                            url = result.url;
                        }
                    }

                    // Fetch the data from the resolved URL
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch artifact data: ${response.statusText}`);
                    }

                    // Detect CSV files by artifact path extension
                    const isCsv = ref.artifactPath.toLowerCase().endsWith('.csv');
                    let data: any[];

                    if (isCsv) {
                        // Parse CSV to JSON array
                        const csvText = await response.text();
                        const parseResult = Papa.parse(csvText, {
                            header: true,
                            skipEmptyLines: true,
                            dynamicTyping: true, // Auto-convert numbers and booleans
                        });
                        data = parseResult.data as any[];
                    } else {
                        // Parse as JSON
                        const jsonData = await response.json();
                        data = Array.isArray(jsonData) ? jsonData : [jsonData];
                    }

                    resolvedData.set(pathKey, data);
                } catch (err) {
                    console.error(`Failed to resolve artifact: ${ref.artifactPath}`, err);
                    if (!cancelled) {
                        setArtifactError(`Failed to load data from artifact: ${ref.artifactPath}`);
                    }
                    return;
                }
            }

            if (!cancelled) {
                const newSpec = replaceArtifactData(vegaSpec, resolvedData);
                setResolvedSpec(newSpec);
                setIsLoadingArtifacts(false);
            }
        };

        resolveArtifacts();

        return () => {
            cancelled = true;
        };
    }, [vegaSpec, artifactRunId]);

    // Detect dark mode
    const [isDarkMode, setIsDarkMode] = useState(false);
    const isDarkModeRef = useRef(false);
    useEffect(() => {
        const checkDarkMode = () => {
            const newDarkMode = document.documentElement.classList.contains('dark');
            // Only update state if dark mode actually changed
            if (newDarkMode !== isDarkModeRef.current) {
                isDarkModeRef.current = newDarkMode;
                setIsDarkMode(newDarkMode);
            }
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Track container width for responsive sizing
    const [containerWidth, setContainerWidth] = useState(0);
    const containerWidthRef = useRef(0);
    useEffect(() => {
        if (!containerRef.current) return;
        let resizeTimeout: ReturnType<typeof setTimeout>;
        const resizeObserver = new ResizeObserver((entries) => {
            // Debounce resize callbacks to ~100ms to avoid excessive state updates
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const width = entries[0]?.contentRect.width;
                if (width && width !== containerWidthRef.current) {
                    containerWidthRef.current = width;
                    setContainerWidth(width);
                }
            }, 100);
        });
        resizeObserver.observe(containerRef.current);
        // Initial width
        const initialWidth = containerRef.current.clientWidth;
        containerWidthRef.current = initialWidth;
        setContainerWidth(initialWidth);
        return () => {
            clearTimeout(resizeTimeout);
            resizeObserver.disconnect();
        };
    }, []);

    // Check if there are artifact references that need resolution
    const hasArtifactReferences = useMemo(() => {
        return findArtifactReferences(vegaSpec).length > 0;
    }, [vegaSpec]);

    // Memoize the processed spec to fix Vega-Lite selection param issues
    // This handles the duplicate signal problem in concatenated views
    const processedSpec = useMemo(() => {
        // If there are artifact references, we must wait for resolvedSpec
        // Don't fall back to vegaSpec which contains artifact: URLs
        if (hasArtifactReferences && !resolvedSpec) {
            return null;
        }
        let specToUse = resolvedSpec || vegaSpec;
        if (!specToUse) return null;

        // Apply parameter values if provided (allows model to set initial slider/dropdown values)
        if (options?.parameterValues) {
            specToUse = applyParameterValues(specToUse, options.parameterValues);
        }

        return fixVegaLiteSelectionParams(specToUse);
    }, [resolvedSpec, vegaSpec, hasArtifactReferences, options?.parameterValues]);

    // Scale widths in concatenated views to fit container
    const scaleSpecWidths = useCallback((spec: any, availableWidth: number): any => {
        if (!spec || typeof spec !== 'object') return spec;

        // Handle hconcat - distribute width among children
        if (spec.hconcat && Array.isArray(spec.hconcat)) {
            const childCount = spec.hconcat.length;
            const spacing = spec.spacing ?? 10;
            const totalSpacing = spacing * (childCount - 1);
            const widthPerChild = Math.floor((availableWidth - totalSpacing) / childCount);

            return {
                ...spec,
                hconcat: spec.hconcat.map((child: any) => scaleSpecWidths(child, widthPerChild)),
            };
        }

        // Handle vconcat - each child gets full width
        if (spec.vconcat && Array.isArray(spec.vconcat)) {
            return {
                ...spec,
                vconcat: spec.vconcat.map((child: any) => scaleSpecWidths(child, availableWidth)),
            };
        }

        // Handle generic concat with columns
        if (spec.concat && Array.isArray(spec.concat)) {
            const columns = spec.columns ?? spec.concat.length;
            const spacing = spec.spacing ?? 10;
            const totalSpacing = spacing * (columns - 1);
            const widthPerChild = Math.floor((availableWidth - totalSpacing) / columns);

            return {
                ...spec,
                concat: spec.concat.map((child: any) => scaleSpecWidths(child, widthPerChild)),
            };
        }

        // For leaf views, set width if it's "container" or larger than available
        const currentWidth = spec.width;
        if (currentWidth === 'container' || (typeof currentWidth === 'number' && currentWidth > availableWidth)) {
            return { ...spec, width: availableWidth };
        }

        return spec;
    }, []);

    // Build the full Vega-Lite spec with defaults
    const buildFullSpec = useCallback((height: number, forFullscreen = false): VisualizationSpec | null => {
        if (!processedSpec) return null;

        const config = getDarkModeConfig(isDarkMode);
        // Use measured container width, window width for fullscreen (capped), or fallback
        const calculatedWidth = forFullscreen
            ? (typeof window !== 'undefined' ? Math.min(window.innerWidth - 80, 1400) : 1200)
            : (containerWidth > 0 ? containerWidth - 24 : 500);

        // Check if this is a concatenated view - autosize 'fit' only works for single/layered views
        const isConcatenatedView = 'vconcat' in processedSpec || 'hconcat' in processedSpec || 'concat' in processedSpec;

        // For concatenated views, use 'pad' which works correctly; for single views use 'fit'
        const autosize = isConcatenatedView
            ? { type: 'pad' as const, contains: 'padding' as const }
            : { type: 'fit' as const, contains: 'padding' as const };

        // Scale widths for concatenated views to fit container
        let scaledSpec = processedSpec;
        if (isConcatenatedView && calculatedWidth) {
            scaledSpec = scaleSpecWidths(processedSpec, calculatedWidth);
        }

        // Replace "container" width with our measured width - "container" relies on CSS which may not be ready
        const specWidth = (scaledSpec as any).width;
        const width = isConcatenatedView ? undefined : (specWidth === 'container' ? calculatedWidth : (specWidth ?? calculatedWidth));

        // Destructure to remove width from spec so we can control it (only for non-concat views)
        const { width: _specWidth, ...specWithoutWidth } = scaledSpec as any;

        return {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
            ...(!isConcatenatedView && width ? { width } : {}),
            height: forFullscreen ? undefined : height,
            autosize,
            ...(isConcatenatedView ? scaledSpec : specWithoutWidth),
            // Override title if provided at top level
            ...(title && !processedSpec.title ? { title } : {}),
            // Apply theme config
            config: {
                ...config,
                ...processedSpec.config,
            },
        };
    }, [processedSpec, title, isDarkMode, containerWidth, scaleSpecWidths]);

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

    const handleError = useCallback((err: unknown) => {
        console.error('Vega-Lite rendering error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
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

    // Show loading state when resolving artifacts
    // Also show loading if we have artifact refs but haven't resolved them yet
    // (covers the gap before the effect runs)
    if (isLoadingArtifacts || (hasArtifactReferences && !resolvedSpec)) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {title || 'Chart'}
                        </span>
                    </div>
                    <div
                        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded"
                        style={{ width: '100%', height: baseHeight }}
                    >
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Loading data from artifacts...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show artifact error state
    if (artifactError) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {title || 'Chart'}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: baseHeight }}>
                        <VegaErrorDisplay error={artifactError} chartTitle={title} />
                    </div>
                </div>
            </div>
        );
    }

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

    // Build spec for rendering
    const chartSpec = buildFullSpec(baseHeight);
    const fullscreenSpec = buildFullSpec(0, true);

    // Handle case when spec isn't ready yet
    if (!chartSpec) {
        return null;
    }

    // Debug: Log renders to track unnecessary re-renders (enable with localStorage)
    if (typeof window !== 'undefined' && localStorage.getItem('DEBUG_VEGA_RENDERS')) {
        console.log('VegaLite rendering with spec:', {
            title,
            hasData: !!(chartSpec as any).data?.values,
            dataLength: (chartSpec as any).data?.values?.length,
        });
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
                        <VegaEmbed
                            spec={chartSpec}
                            onEmbed={(result) => handleNewView(result.view)}
                            onError={handleError}
                            options={{ renderer: options?.renderer || 'canvas', actions: false }}
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
                    {fullscreenSpec && (
                        <VegaEmbed
                            spec={fullscreenSpec}
                            onEmbed={(result) => handleFullscreenNewView(result.view)}
                            onError={handleError}
                            options={{ renderer: options?.renderer || 'canvas', actions: false }}
                        />
                    )}
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
    return JSON.stringify(prevProps.spec) === JSON.stringify(nextProps.spec) &&
        prevProps.artifactRunId === nextProps.artifactRunId;
});
