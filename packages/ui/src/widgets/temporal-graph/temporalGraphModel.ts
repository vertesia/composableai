/**
 * Pure model behind {@link TemporalGraph}.
 *
 * Everything in this module is deterministic and free of DOM, React and timing dependencies:
 * the same input always produces the same output, which is what lets the component memoize the
 * layout and treat hover/selection as pure decoration. No `Math.random`, no `Date.now`.
 */

/** A vertex of the graph. `data` carries whatever the host needs to resolve a selection. */
export interface TemporalGraphNode<T = unknown> {
    id: string;
    label: string;
    /** Secondary line rendered under the label (ticker, kind, …). */
    sublabel?: string;
    /** Key into the `groups` record; drives the categorical color. */
    group?: string;
    data?: T;
}

/** One piece of grounding attached to an edge. */
export interface TemporalGraphEvidence {
    source: string;
    locator?: string;
    excerpt?: string;
}

/** A directed statement between two nodes. */
export interface TemporalGraphEdge<T = unknown> {
    id: string;
    source: string;
    target: string;
    /** Predicate shown along the edge. */
    label?: string;
    /** 0..1. Rendered next to the label when below 1, dashed ("inference") when below 0.9. */
    confidence?: number;
    /**
     * Belief time: the ISO instant at which the statement became known. Drives the as-of cutoff —
     * an edge observed after the cutoff is something the brain did not know yet.
     */
    observedAt?: string;
    /**
     * Business validity, distinct from {@link observedAt}: when the statement started and stopped
     * being *in force*. An expired statement is still remembered and still drawn — it is simply no
     * longer true as of the cutoff.
     */
    validFrom?: string;
    validTo?: string;
    /** Statement context, e.g. `{ commodity: 'GPUs', product: 'GB200' }`. */
    qualifiers?: Record<string, string | number>;
    evidence?: TemporalGraphEvidence[];
    data?: T;
}

/** Presentation metadata for one node group. */
export interface TemporalGraphGroup {
    label: string;
    /** Any CSS color. When omitted a categorical palette entry is assigned deterministically. */
    color?: string;
}

export type TemporalGraphSelectionType = 'node' | 'edge';

export interface TemporalGraphSelection {
    type: TemporalGraphSelectionType;
    id: string;
}

export interface TemporalGraphLayoutOptions {
    /** Virtual canvas the layout is computed in. The SVG viewBox is fitted to the result. */
    width?: number;
    height?: number;
    /** Fixed iteration count. Fixed, not convergence-based, so the result stays reproducible. */
    iterations?: number;
    /** Seeds the deterministic PRNG used for the initial placement. */
    seed?: number;
    /** Radius of a node with no visible edge. */
    nodeRadiusBase?: number;
    /** Radius added per visible incident edge. */
    nodeRadiusStep?: number;
    /** Upper bound so a hub cannot swallow the canvas. */
    nodeRadiusMax?: number;
}

export interface TemporalGraphPoint {
    x: number;
    y: number;
}

export interface TemporalGraphViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Categorical palette for node groups.
 *
 * Mid-lightness, mid-chroma oklch: every entry keeps enough contrast against both the light and
 * the dark surface tokens, so a single palette serves both themes. These are the only literal
 * colors in the widget — everything else is a semantic token.
 */
export const TEMPORAL_GRAPH_PALETTE = [
    'oklch(0.70 0.12 220)',
    'oklch(0.70 0.13 155)',
    'oklch(0.68 0.14 300)',
    'oklch(0.74 0.13 75)',
    'oklch(0.68 0.15 15)',
    'oklch(0.72 0.10 195)',
    'oklch(0.66 0.14 265)',
    'oklch(0.74 0.14 120)',
] as const;

export const DEFAULT_LAYOUT_OPTIONS = {
    width: 1000,
    height: 640,
    iterations: 320,
    seed: 1,
    nodeRadiusBase: 10,
    nodeRadiusStep: 3.5,
    nodeRadiusMax: 34,
} satisfies Required<TemporalGraphLayoutOptions>;

/** Confidence at or above which an edge is drawn solid rather than dashed. */
export const CONFIDENCE_INFERENCE_THRESHOLD = 0.9;

function resolveLayoutOptions(options?: TemporalGraphLayoutOptions): Required<TemporalGraphLayoutOptions> {
    return { ...DEFAULT_LAYOUT_OPTIONS, ...options };
}

/** FNV-1a over the node id: a stable per-node seed that does not depend on array order. */
function hashString(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** mulberry32 — small, fast, fully deterministic given the seed. */
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * True when the edge is known at `asOf`. An edge with no `observedAt` is timeless and always
 * visible; an empty cutoff disables the filter entirely.
 */
export function isEdgeObservedBy(edge: TemporalGraphEdge, asOf?: string): boolean {
    if (!asOf) return true;
    if (!edge.observedAt) return true;
    return edge.observedAt <= asOf;
}

/** Ids of the edges known at `asOf`. */
export function visibleEdgeIds(edges: TemporalGraphEdge[], asOf?: string): Set<string> {
    const visible = new Set<string>();
    for (const edge of edges) {
        if (isEdgeObservedBy(edge, asOf)) visible.add(edge.id);
    }
    return visible;
}

/** Number of incident visible edges per node. Self-loops count once. */
export function computeDegrees(edges: TemporalGraphEdge[], asOf?: string): Map<string, number> {
    const degrees = new Map<string, number>();
    const bump = (id: string) => degrees.set(id, (degrees.get(id) ?? 0) + 1);
    for (const edge of edges) {
        if (!isEdgeObservedBy(edge, asOf)) continue;
        bump(edge.source);
        if (edge.target !== edge.source) bump(edge.target);
    }
    return degrees;
}

/** Radius for a node with `degree` visible edges. */
export function computeNodeRadius(degree: number, options?: TemporalGraphLayoutOptions): number {
    const resolved = resolveLayoutOptions(options);
    return Math.min(resolved.nodeRadiusBase + degree * resolved.nodeRadiusStep, resolved.nodeRadiusMax);
}

/**
 * The focused node plus every node one visible edge away from it. Returns `undefined` when there
 * is nothing focused, which the component reads as "dim nothing".
 */
export function computeNeighborhood(
    edges: TemporalGraphEdge[],
    nodeId: string | undefined,
    asOf?: string,
): Set<string> | undefined {
    if (!nodeId) return undefined;
    const neighborhood = new Set<string>([nodeId]);
    for (const edge of edges) {
        if (!isEdgeObservedBy(edge, asOf)) continue;
        if (edge.source === nodeId) neighborhood.add(edge.target);
        if (edge.target === nodeId) neighborhood.add(edge.source);
    }
    return neighborhood;
}

/** Every distinct group key present in `nodes`, in first-appearance order. */
export function collectGroupKeys(nodes: TemporalGraphNode[]): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
        const key = node.group;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
    }
    return keys;
}

/**
 * Resolve the legend: declared groups keep their label and color, undeclared ones get a humanized
 * label and a palette color. Assignment is by sorted key so it does not drift when the node array
 * is reordered or filtered.
 */
export function resolveGroupStyles(
    nodes: TemporalGraphNode[],
    groups?: Record<string, TemporalGraphGroup>,
): Record<string, Required<TemporalGraphGroup>> {
    const keys = new Set<string>([...collectGroupKeys(nodes), ...Object.keys(groups ?? {})]);
    const sorted = [...keys].sort();
    const resolved: Record<string, Required<TemporalGraphGroup>> = {};
    sorted.forEach((key, index) => {
        const declared = groups?.[key];
        resolved[key] = {
            label: declared?.label ?? key.replaceAll('_', ' '),
            color: declared?.color ?? TEMPORAL_GRAPH_PALETTE[index % TEMPORAL_GRAPH_PALETTE.length],
        };
    });
    return resolved;
}

/**
 * Deterministic seeded force-directed layout (Fruchterman-Reingold with a mild centering pull).
 *
 * Initial placement comes from a PRNG seeded per node id, so adding a node never reshuffles the
 * others' seeds. The iteration count is fixed rather than convergence-based: the same input must
 * always produce the same coordinates, otherwise a re-render could silently move the graph.
 */
export function layoutTemporalGraph(
    nodes: TemporalGraphNode[],
    edges: TemporalGraphEdge[],
    options?: TemporalGraphLayoutOptions,
): Map<string, TemporalGraphPoint> {
    const { width, height, iterations, seed } = resolveLayoutOptions(options);
    const positions = new Map<string, TemporalGraphPoint>();
    if (nodes.length === 0) return positions;

    const centerX = width / 2;
    const centerY = height / 2;
    if (nodes.length === 1) {
        positions.set(nodes[0].id, { x: centerX, y: centerY });
        return positions;
    }

    // Seed each node from its own id so the starting ring is stable per node, then nudge with a
    // PRNG to break the perfect symmetry that would otherwise stall the force simulation.
    const points = nodes.map((node, index) => {
        const random = createRandom(hashString(node.id) ^ seed);
        const angle = ((index / nodes.length) * Math.PI * 2 + random() * 0.5) % (Math.PI * 2);
        const radius = (0.18 + random() * 0.3) * Math.min(width, height);
        return { id: node.id, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    });
    const index = new Map(points.map((point, position) => [point.id, position]));

    const links = edges.flatMap((edge) => {
        const from = index.get(edge.source);
        const to = index.get(edge.target);
        return from === undefined || to === undefined || from === to ? [] : [[from, to] as const];
    });

    const k = Math.sqrt((width * height) / nodes.length);
    const displacementX = new Float64Array(points.length);
    const displacementY = new Float64Array(points.length);

    for (let step = 0; step < iterations; step++) {
        displacementX.fill(0);
        displacementY.fill(0);

        for (let a = 0; a < points.length; a++) {
            for (let b = a + 1; b < points.length; b++) {
                let dx = points[a].x - points[b].x;
                let dy = points[a].y - points[b].y;
                let distance = Math.hypot(dx, dy);
                if (distance < 0.01) {
                    // Perfectly coincident nodes have no direction to separate along: pick one
                    // derived from the index pair so the tie-break stays deterministic.
                    dx = ((a % 7) - 3) / 10 || 0.05;
                    dy = ((b % 5) - 2) / 10 || 0.05;
                    distance = Math.hypot(dx, dy);
                }
                const force = (k * k) / distance;
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                displacementX[a] += fx;
                displacementY[a] += fy;
                displacementX[b] -= fx;
                displacementY[b] -= fy;
            }
        }

        for (const [from, to] of links) {
            const dx = points[from].x - points[to].x;
            const dy = points[from].y - points[to].y;
            const distance = Math.max(Math.hypot(dx, dy), 0.01);
            const force = (distance * distance) / k;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            displacementX[from] -= fx;
            displacementY[from] -= fy;
            displacementX[to] += fx;
            displacementY[to] += fy;
        }

        // Linear cooling: large early moves, sub-pixel ones at the end.
        const temperature = (width / 10) * (1 - step / iterations);
        for (let a = 0; a < points.length; a++) {
            // Gravity holds disconnected components near the graph. It has to be strong enough to
            // beat repulsion on a node no edge pulls back: a sparse graph is mostly isolated nodes,
            // and at 0.012 they drifted to the bounds and left the connected core unreadably small.
            displacementX[a] += (centerX - points[a].x) * 0.06;
            displacementY[a] += (centerY - points[a].y) * 0.06;
            const distance = Math.max(Math.hypot(displacementX[a], displacementY[a]), 0.01);
            const limited = Math.min(distance, temperature);
            points[a].x += (displacementX[a] / distance) * limited;
            points[a].y += (displacementY[a] / distance) * limited;
            // Hard bounds. Gravity alone does not hold a node that no edge pulls back, and one
            // escaped node stretches the fitted viewBox until the rest of the graph renders as
            // specks too small to see or click.
            points[a].x = Math.min(Math.max(points[a].x, 0), width);
            points[a].y = Math.min(Math.max(points[a].y, 0), height);
        }
    }

    for (const point of points) {
        positions.set(point.id, { x: point.x, y: point.y });
    }
    return positions;
}

/** Bounding viewBox around the laid-out nodes, grown by each node's radius plus `padding`. */
export function computeGraphViewBox(
    positions: Map<string, TemporalGraphPoint>,
    radii: Map<string, number>,
    padding = 56,
    fallback: TemporalGraphViewBox = {
        x: 0,
        y: 0,
        width: DEFAULT_LAYOUT_OPTIONS.width,
        height: DEFAULT_LAYOUT_OPTIONS.height,
    },
): TemporalGraphViewBox {
    if (positions.size === 0) return fallback;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [id, point] of positions) {
        // The label sits below the circle, so the bottom margin has to clear it too.
        const radius = (radii.get(id) ?? DEFAULT_LAYOUT_OPTIONS.nodeRadiusBase) + 18;
        minX = Math.min(minX, point.x - radius);
        minY = Math.min(minY, point.y - radius);
        maxX = Math.max(maxX, point.x + radius);
        maxY = Math.max(maxY, point.y + radius);
    }
    return {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(maxX - minX + padding * 2, 1),
        height: Math.max(maxY - minY + padding * 2, 1),
    };
}

/**
 * Identity of the rendered data set: which records are on screen, independent of how many.
 *
 * Selection and hover never change it, so the viewport is left alone while the user explores;
 * swapping one record for another at an equal count — which a count-based key could not see —
 * does change it and re-frames the graph.
 */
export function computeGraphIdentity(nodes: TemporalGraphNode[], edges: TemporalGraphEdge[]): string {
    if (nodes.length === 0) return '';
    const nodeIds = nodes.map((node) => node.id).sort();
    const edgeIds = edges.map((edge) => edge.id).sort();
    return `${nodeIds.join('|')}::${edgeIds.join('|')}`;
}

/**
 * True when the statement stopped being in force before the cutoff.
 *
 * Belief time (`observedAt`) and validity (`validTo`) are independent: an expired statement is
 * still known — the brain remembers it — so it stays on the graph, dimmed and marked "ended".
 */
export function isExpiredEdge(edge: TemporalGraphEdge, asOf?: string): boolean {
    return Boolean(asOf && edge.validTo && edge.validTo < asOf);
}

/** `key=value · key=value` rendering of an edge's statement context. Empty when there is none. */
export function formatQualifiers(qualifiers?: Record<string, string | number>): string {
    if (!qualifiers) return '';
    return Object.entries(qualifiers)
        .map(([key, value]) => `${key}=${value}`)
        .join(' · ');
}

/** The first qualifier value, which is the one compact enough to ride along the edge label. */
export function primaryQualifierValue(qualifiers?: Record<string, string | number>): string | undefined {
    if (!qualifiers) return undefined;
    const [first] = Object.values(qualifiers);
    return first === undefined ? undefined : String(first);
}

/**
 * Label drawn along an edge: the predicate, its leading qualifier, the confidence when it is not a
 * certainty, and an "ended" marker once the statement is out of force at the cutoff.
 */
export function formatEdgeLabel(edge: TemporalGraphEdge, asOf?: string): string {
    const qualifier = primaryQualifierValue(edge.qualifiers);
    let label = `${edge.label ?? ''}${qualifier ? `·${qualifier}` : ''}`;
    if (edge.confidence !== undefined && Number.isFinite(edge.confidence) && edge.confidence < 1) {
        const confidence = `·${edge.confidence.toFixed(2)}`;
        label = label ? `${label} ${confidence}` : confidence;
    }
    if (isExpiredEdge(edge, asOf)) {
        label = label ? `${label} ·ended` : '·ended';
    }
    return label;
}

/** Marker placed on a time scrubber track, positioned as a 0..1 ratio along the stops. */
export interface TemporalTimelineMarker<T = unknown> {
    id: string;
    date: string;
    label: string;
    /** Index of the latest stop at or before `date`, clamped into range. */
    stopIndex: number;
    /** Horizontal position along the track, 0 at the first stop and 1 at the last. */
    ratio: number;
    data?: T;
}

/**
 * Place episodes on a scrubber track.
 *
 * Episodes rarely land exactly on a stop, so each one snaps back to the latest stop at or before
 * its date — clicking the marker then moves the cutoff to a value the scrubber can actually hold.
 * Episodes before the first stop snap forward to it rather than being dropped.
 */
export function computeTimelineMarkers<T>(
    stops: string[],
    episodes: { id: string; date: string; label: string; data?: T }[],
): TemporalTimelineMarker<T>[] {
    if (stops.length === 0) return [];
    const lastIndex = stops.length - 1;
    return episodes.map((episode) => {
        let stopIndex = 0;
        for (let index = 0; index <= lastIndex; index++) {
            if (stops[index] <= episode.date) stopIndex = index;
        }
        return {
            id: episode.id,
            date: episode.date,
            label: episode.label,
            stopIndex,
            ratio: lastIndex === 0 ? 0 : stopIndex / lastIndex,
            data: episode.data,
        };
    });
}

/** Below the threshold an edge is an inference rather than an explicit statement. */
export function isInferredEdge(edge: TemporalGraphEdge): boolean {
    return edge.confidence !== undefined && Number.isFinite(edge.confidence)
        ? edge.confidence < CONFIDENCE_INFERENCE_THRESHOLD
        : false;
}

/** Sorted, de-duplicated observation dates — the stops of an as-of scrubber. */
export function collectObservedDates(edges: TemporalGraphEdge[]): string[] {
    const dates = new Set<string>();
    for (const edge of edges) {
        if (edge.observedAt) dates.add(edge.observedAt);
    }
    return [...dates].sort();
}
