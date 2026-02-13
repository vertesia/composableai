// ---------------------------------------------------------------------------
// BatchProgressPanel theme classes (14 slots)
// ---------------------------------------------------------------------------

/** Class overrides for individual BatchProgressPanel DOM elements. */
export interface BatchProgressPanelThemeClasses {
    /** Root container: "border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5" */
    root?: string;
    /** Header row: "flex items-center justify-between px-4 py-2 ... bg-blue-50/50 ..." */
    header?: string;
    /** Header left group: "flex items-center gap-2" */
    headerLeft?: string;
    /** Status icon wrapper */
    statusIcon?: string;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: string;
    /** Tool name: "text-xs text-blue-600 dark:text-blue-400 font-medium" */
    toolName?: string;
    /** Progress count: "text-xs text-muted" */
    progressCount?: string;
    /** Header right group: "flex items-center gap-2" */
    headerRight?: string;
    /** Timestamp/duration: "text-xs text-muted" */
    timestamp?: string;
    /** Copy button: "text-muted" */
    copyButton?: string;
    /** Progress bar section: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    progressBar?: string;
    /** Progress bar track: "flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" */
    track?: string;
    /** Status counters: "flex items-center gap-2 text-xs" */
    counters?: string;
    /** Item list container: "max-h-64 overflow-y-auto" */
    itemList?: string;
    /** Individual item row: "flex items-center gap-2 px-4 py-1.5 text-xs border-b ..." */
    item?: string;
    /** Summary message: "px-4 py-2 text-xs text-muted" */
    summary?: string;
}

/** BatchProgressPanel theme. */
export type BatchProgressPanelTheme = BatchProgressPanelThemeClasses;

const EMPTY: BatchProgressPanelThemeClasses = {};

export function resolveBatchProgressPanelTheme(
    theme: BatchProgressPanelTheme | undefined,
): BatchProgressPanelThemeClasses {
    return theme ?? EMPTY;
}
