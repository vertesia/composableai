import { type ClassTree, type ThemeClassValue, type ViewMode, buildClassChains, mergeResolvedLayer, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// BatchProgressPanel theme classes (14 total)
// ---------------------------------------------------------------------------

/** Class overrides for individual BatchProgressPanel DOM elements. */
export interface BatchProgressPanelThemeClasses {
    /** Root container: "border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5" */
    root?: ThemeClassValue;
    /** Header row: "flex items-center justify-between px-4 py-2 ... bg-blue-50/50 ..." */
    header?: ThemeClassValue;
    /** Header left group: "flex items-center gap-2" */
    headerLeft?: ThemeClassValue;
    /** Status icon wrapper */
    statusIcon?: ThemeClassValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: ThemeClassValue;
    /** Tool name: "text-xs text-blue-600 dark:text-blue-400 font-medium" */
    toolName?: ThemeClassValue;
    /** Progress count: "text-xs text-muted" */
    progressCount?: ThemeClassValue;
    /** Header right group: "flex items-center gap-2" */
    headerRight?: ThemeClassValue;
    /** Timestamp/duration: "text-xs text-muted" */
    timestamp?: ThemeClassValue;
    /** Copy button: "text-muted" */
    copyButton?: ThemeClassValue;
    /** Progress bar section: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    progressBar?: ThemeClassValue;
    /** Progress bar track: "flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" */
    track?: ThemeClassValue;
    /** Status counters: "flex items-center gap-2 text-xs" */
    counters?: ThemeClassValue;
    /** Item list container: "max-h-64 overflow-y-auto" */
    itemList?: ThemeClassValue;
    /** Individual item row: "flex items-center gap-2 px-4 py-1.5 text-xs border-b ..." */
    item?: ThemeClassValue;
    /** Summary message: "px-4 py-2 text-xs text-muted" */
    summary?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedBatchProgressPanelThemeClasses = { [K in keyof BatchProgressPanelThemeClasses]?: string };

/** BatchProgressPanel theme — no byType, but supports byViewMode. */
export interface BatchProgressPanelTheme extends BatchProgressPanelThemeClasses {
    byViewMode?: Partial<Record<ViewMode, BatchProgressPanelThemeClasses>>;
}

// ---------------------------------------------------------------------------
// Cascade tree — BatchProgressPanel DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof BatchProgressPanelThemeClasses;

const BATCH_PROGRESS_PANEL_TREE: ClassTree = {
    root: {
        header: {
            headerLeft: { statusIcon: {}, sender: {}, toolName: {}, progressCount: {} },
            headerRight: { timestamp: {}, copyButton: {} },
        },
        progressBar: { track: {}, counters: {} },
        itemList: { item: {} },
        summary: {},
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(BATCH_PROGRESS_PANEL_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedBatchProgressPanelThemeClasses = {};

/**
 * Resolve a BatchProgressPanelTheme into a flat set of class strings.
 */
export function resolveBatchProgressPanelTheme(
    theme: BatchProgressPanelTheme | undefined,
    viewMode?: ViewMode,
): ResolvedBatchProgressPanelThemeClasses {
    if (!theme) return EMPTY;

    let resolved = resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveClasses<ClassKey>(theme.byViewMode[viewMode], CLASS_CHAINS, CLASS_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
