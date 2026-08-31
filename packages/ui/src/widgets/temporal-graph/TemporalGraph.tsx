/**
 * biome-ignore-all lint/a11y/useSemanticElements: SVG has no <button>. Nodes and edges are
 * role="button" groups with tabIndex and Enter/Space handlers, which is the accessible equivalent
 * inside an <svg>.
 */
import { cn } from '@vertesia/ui/core';
import {
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    computeDegrees,
    computeGraphIdentity,
    computeGraphViewBox,
    computeNeighborhood,
    computeNodeRadius,
    DEFAULT_LAYOUT_OPTIONS,
    formatEdgeLabel,
    isEdgeObservedBy,
    isExpiredEdge,
    isInferredEdge,
    layoutTemporalGraph,
    resolveGroupStyles,
    type TemporalGraphEdge,
    type TemporalGraphGroup,
    type TemporalGraphLayoutOptions,
    type TemporalGraphNode,
    type TemporalGraphSelection,
    type TemporalGraphViewBox,
} from './temporalGraphModel.js';

export interface TemporalGraphProps<N = unknown, E = unknown> {
    nodes: TemporalGraphNode<N>[];
    edges: TemporalGraphEdge<E>[];
    /** Presentation metadata per node group. Missing groups get a deterministic palette color. */
    groups?: Record<string, TemporalGraphGroup>;
    /** Controlled selection. Providing the prop at all — even as `null` — takes over the state. */
    selection?: TemporalGraphSelection | null;
    /** Initial selection when the graph manages its own. Ignored once `selection` is provided. */
    defaultSelection?: TemporalGraphSelection | null;
    onSelect?: (selection: TemporalGraphSelection | undefined) => void;
    /** ISO cutoff. Edges observed after it are drawn as "not yet known" and stop counting. */
    asOf?: string;
    /**
     * Ids that currently match a host-side filter. Purely decorative: everything outside the set
     * is dimmed, nothing is removed, and the layout is untouched.
     */
    matchedIds?: string[];
    layout?: TemporalGraphLayoutOptions;
    className?: string;
    /** Accessible name of the graph region. */
    label?: string;
    /** Rendered instead of the graph when there is no node to draw. */
    emptyState?: ReactNode;
}

const MIN_VIEWBOX_SCALE = 0.25;
const MAX_VIEWBOX_SCALE = 6;
/** Pointer travel, in CSS pixels, above which a press is a pan rather than a click. */
const PAN_THRESHOLD_PX = 3;

export function TemporalGraph<N = unknown, E = unknown>({
    nodes,
    edges,
    groups,
    selection,
    defaultSelection,
    onSelect,
    asOf,
    matchedIds,
    layout,
    className,
    label,
    emptyState,
}: TemporalGraphProps<N, E>) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const panRef = useRef<{ pointerId: number; clientX: number; clientY: number; moved: boolean } | null>(null);
    /** Set when a press ended as a pan, so the click that follows the release is swallowed. */
    const suppressedClickRef = useRef(false);
    const [internalSelection, setInternalSelection] = useState<TemporalGraphSelection | undefined>(
        defaultSelection ?? undefined,
    );
    const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();
    const [viewBox, setViewBox] = useState<TemporalGraphViewBox | undefined>();

    const isControlled = selection !== undefined;
    const activeSelection = isControlled ? (selection ?? undefined) : internalSelection;

    const select = useCallback(
        (next: TemporalGraphSelection | undefined) => {
            if (!isControlled) setInternalSelection(next);
            onSelect?.(next);
        },
        [isControlled, onSelect],
    );

    // Field-wise memo so an inline `layout={{ … }}` literal does not re-run the force simulation on
    // every render of the host.
    const {
        width: layoutWidth,
        height: layoutHeight,
        iterations: layoutIterations,
        seed: layoutSeed,
        nodeRadiusBase,
        nodeRadiusStep,
        nodeRadiusMax,
    } = layout ?? {};
    const layoutOptions = useMemo<Required<TemporalGraphLayoutOptions>>(
        () => ({
            width: layoutWidth ?? DEFAULT_LAYOUT_OPTIONS.width,
            height: layoutHeight ?? DEFAULT_LAYOUT_OPTIONS.height,
            iterations: layoutIterations ?? DEFAULT_LAYOUT_OPTIONS.iterations,
            seed: layoutSeed ?? DEFAULT_LAYOUT_OPTIONS.seed,
            nodeRadiusBase: nodeRadiusBase ?? DEFAULT_LAYOUT_OPTIONS.nodeRadiusBase,
            nodeRadiusStep: nodeRadiusStep ?? DEFAULT_LAYOUT_OPTIONS.nodeRadiusStep,
            nodeRadiusMax: nodeRadiusMax ?? DEFAULT_LAYOUT_OPTIONS.nodeRadiusMax,
        }),
        [layoutWidth, layoutHeight, layoutIterations, layoutSeed, nodeRadiusBase, nodeRadiusStep, nodeRadiusMax],
    );

    // Layout depends on the data and the layout options only. Selection, hover, the as-of cutoff
    // and the match set are decoration: none of them may move a node.
    const positions = useMemo(() => layoutTemporalGraph(nodes, edges, layoutOptions), [nodes, edges, layoutOptions]);
    const groupStyles = useMemo(() => resolveGroupStyles(nodes, groups), [nodes, groups]);
    const visibleDegrees = useMemo(() => computeDegrees(edges, asOf), [edges, asOf]);
    const graphIdentity = useMemo(() => computeGraphIdentity(nodes, edges), [nodes, edges]);
    const matched = useMemo(() => (matchedIds ? new Set(matchedIds) : undefined), [matchedIds]);

    // Framing uses the full edge set so scrubbing the as-of cutoff never re-frames the viewport.
    const fitViewBox = useMemo(() => {
        const fullDegrees = computeDegrees(edges);
        const radii = new Map<string, number>();
        for (const node of nodes) radii.set(node.id, computeNodeRadius(fullDegrees.get(node.id) ?? 0, layoutOptions));
        return computeGraphViewBox(positions, radii);
    }, [nodes, edges, positions, layoutOptions]);

    useEffect(() => {
        // Re-frame when the rendered records change, never when the selection does.
        if (!graphIdentity) return;
        setViewBox(fitViewBox);
    }, [graphIdentity, fitViewBox]);

    const activeViewBox = viewBox ?? fitViewBox;

    // React registers `wheel` passively at the root, so a native non-passive listener is the only
    // way to zoom without also scrolling the page.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = svg.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            setViewBox((current) => {
                const base = current ?? fitViewBox;
                const factor = Math.exp(event.deltaY * 0.0015);
                const nextWidth = base.width * factor;
                const nextHeight = base.height * factor;
                const scale = fitViewBox.width / nextWidth;
                if (scale < MIN_VIEWBOX_SCALE || scale > MAX_VIEWBOX_SCALE) return base;
                const ratioX = (event.clientX - rect.left) / rect.width;
                const ratioY = (event.clientY - rect.top) / rect.height;
                return {
                    x: base.x + (base.width - nextWidth) * ratioX,
                    y: base.y + (base.height - nextHeight) * ratioY,
                    width: nextWidth,
                    height: nextHeight,
                };
            });
        };
        svg.addEventListener('wheel', onWheel, { passive: false });
        return () => svg.removeEventListener('wheel', onWheel);
    }, [fitViewBox]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) return;
        panRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, moved: false };
        // Pointer capture is optional: jsdom and a few embedded webviews do not implement it on
        // SVG elements, and panning still works without it.
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, []);

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<SVGSVGElement>) => {
            const pan = panRef.current;
            const svg = svgRef.current;
            if (!pan || !svg || pan.pointerId !== event.pointerId) return;
            const rect = svg.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dx = event.clientX - pan.clientX;
            const dy = event.clientY - pan.clientY;
            if (!pan.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
            pan.moved = true;
            pan.clientX = event.clientX;
            pan.clientY = event.clientY;
            setViewBox((current) => {
                const base = current ?? fitViewBox;
                return {
                    ...base,
                    x: base.x - (dx / rect.width) * base.width,
                    y: base.y - (dy / rect.height) * base.height,
                };
            });
        },
        [fitViewBox],
    );

    const endPan = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const pan = panRef.current;
        if (!pan || pan.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (pan.moved) suppressedClickRef.current = true;
        panRef.current = null;
    }, []);

    const consumeClick = useCallback(() => {
        if (!suppressedClickRef.current) return true;
        suppressedClickRef.current = false;
        return false;
    }, []);

    const handleBackgroundClick = useCallback(() => {
        if (!consumeClick()) return;
        select(undefined);
    }, [consumeClick, select]);

    /** Escape is the keyboard equivalent of clicking the empty pane. */
    const handlePaneKeyDown = useCallback(
        (event: ReactKeyboardEvent<SVGSVGElement>) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            select(undefined);
        },
        [select],
    );

    const focusedNodeId = hoveredNodeId ?? (activeSelection?.type === 'node' ? activeSelection.id : undefined);
    const neighborhood = useMemo(() => computeNeighborhood(edges, focusedNodeId, asOf), [edges, focusedNodeId, asOf]);

    if (nodes.length === 0) {
        return (
            <div className={cn('flex h-full min-h-64 items-center justify-center p-6 text-center', className)}>
                {emptyState}
            </div>
        );
    }

    return (
        <svg
            ref={svgRef}
            className={cn('h-full w-full touch-none select-none', className)}
            viewBox={`${activeViewBox.x} ${activeViewBox.y} ${activeViewBox.width} ${activeViewBox.height}`}
            role="application"
            aria-label={label}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onClick={handleBackgroundClick}
            onKeyDown={handlePaneKeyDown}
        >
            <g>
                {edges.map((edge) => {
                    const from = positions.get(edge.source);
                    const to = positions.get(edge.target);
                    if (!from || !to) return null;
                    const isKnown = isEdgeObservedBy(edge, asOf);
                    const isExpired = isExpiredEdge(edge, asOf);
                    const isSelected = activeSelection?.type === 'edge' && activeSelection.id === edge.id;
                    const isIncident =
                        focusedNodeId !== undefined && (edge.source === focusedNodeId || edge.target === focusedNodeId);
                    const isDimmed =
                        (neighborhood !== undefined && !isIncident) || (matched !== undefined && !matched.has(edge.id));
                    const text = formatEdgeLabel(edge, asOf);
                    // An expired statement never lights up: it is remembered, not in force.
                    const isHot = (isSelected || (isIncident && isKnown)) && !isExpired;
                    return (
                        <g
                            key={edge.id}
                            role="button"
                            tabIndex={isKnown ? 0 : -1}
                            aria-label={text || edge.id}
                            aria-pressed={isSelected}
                            className={cn(
                                'cursor-pointer outline-none motion-safe:transition-opacity',
                                'focus-visible:[&>line.temporal-graph-hit]:opacity-100',
                                !isKnown && 'pointer-events-none opacity-10',
                                isKnown && isDimmed && 'opacity-20',
                            )}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (!consumeClick()) return;
                                select({ type: 'edge', id: edge.id });
                            }}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                select({ type: 'edge', id: edge.id });
                            }}
                        >
                            <title>{text || edge.id}</title>
                            {/* Invisible until focused: widens the pointer target and doubles as the focus ring. */}
                            <line
                                className="temporal-graph-hit stroke-ring opacity-0"
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                strokeWidth={10}
                            />
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                className={cn(
                                    'motion-safe:transition-opacity',
                                    isHot ? 'stroke-info' : 'stroke-muted',
                                    isExpired
                                        ? '[stroke-dasharray:2_5]'
                                        : isInferredEdge(edge) && '[stroke-dasharray:5_4]',
                                    isKnown && !isDimmed && isExpired && 'opacity-25',
                                    isKnown && !isDimmed && !isExpired && 'opacity-80',
                                )}
                                strokeWidth={isSelected ? 2.6 : isHot ? 2 : 1.4}
                            />
                            {text ? (
                                <text
                                    x={(from.x + to.x) / 2}
                                    y={(from.y + to.y) / 2 - 5}
                                    textAnchor="middle"
                                    fontSize={8.5}
                                    className={cn(
                                        'pointer-events-none font-mono motion-safe:transition-opacity',
                                        isHot ? 'fill-info' : 'fill-muted',
                                        !isKnown && 'opacity-0',
                                        isKnown && isDimmed && 'opacity-15',
                                        isKnown && !isDimmed && isExpired && 'opacity-50',
                                    )}
                                >
                                    {text}
                                </text>
                            ) : null}
                        </g>
                    );
                })}
            </g>
            <g>
                {nodes.map((node) => {
                    const point = positions.get(node.id);
                    if (!point) return null;
                    const degree = visibleDegrees.get(node.id) ?? 0;
                    const radius = computeNodeRadius(degree, layoutOptions);
                    const style = node.group ? groupStyles[node.group] : undefined;
                    const color = style?.color ?? 'currentColor';
                    const isSelected = activeSelection?.type === 'node' && activeSelection.id === node.id;
                    const isDimmed =
                        (neighborhood !== undefined && !neighborhood.has(node.id)) ||
                        (matched !== undefined && !matched.has(node.id));
                    return (
                        <g
                            key={node.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${node.label}${style ? `, ${style.label}` : ''}, ${degree} links`}
                            aria-pressed={isSelected}
                            className={cn(
                                'cursor-pointer outline-none motion-safe:transition-opacity',
                                'focus-visible:[&>circle.temporal-graph-focus-ring]:opacity-100',
                                isDimmed && 'opacity-20',
                            )}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (!consumeClick()) return;
                                select({ type: 'node', id: node.id });
                            }}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                select({ type: 'node', id: node.id });
                            }}
                            onPointerEnter={() => setHoveredNodeId(node.id)}
                            onPointerLeave={() =>
                                setHoveredNodeId((current) => (current === node.id ? undefined : current))
                            }
                            onFocus={() => setHoveredNodeId(node.id)}
                            onBlur={() => setHoveredNodeId((current) => (current === node.id ? undefined : current))}
                        >
                            <circle
                                className="temporal-graph-focus-ring stroke-ring opacity-0"
                                cx={point.x}
                                cy={point.y}
                                r={radius + 9}
                                fill="none"
                                strokeWidth={1.5}
                            />
                            {isSelected ? (
                                <circle
                                    className={cn(
                                        'stroke-foreground [stroke-dasharray:3_3]',
                                        '[transform-box:fill-box] [transform-origin:center]',
                                        'motion-safe:animate-[spin_14s_linear_infinite]',
                                    )}
                                    cx={point.x}
                                    cy={point.y}
                                    r={radius + 6}
                                    fill="none"
                                    strokeWidth={1.5}
                                />
                            ) : null}
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r={radius}
                                fill={`color-mix(in oklch, ${color} 22%, transparent)`}
                                stroke={color}
                                strokeWidth={1.5}
                            />
                            <text
                                x={point.x}
                                y={point.y + radius + 14}
                                textAnchor="middle"
                                fontSize={11}
                                className="pointer-events-none fill-foreground font-mono"
                            >
                                {node.label}
                            </text>
                            {node.sublabel ? (
                                <text
                                    x={point.x}
                                    y={point.y + radius + 25}
                                    textAnchor="middle"
                                    fontSize={8}
                                    className="pointer-events-none fill-muted font-mono"
                                >
                                    {node.sublabel}
                                </text>
                            ) : null}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
