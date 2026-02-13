// ---------------------------------------------------------------------------
// ToolCallGroup theme classes (16 slots)
// ---------------------------------------------------------------------------

/** Class overrides for individual ToolCallGroup DOM elements. */
export interface ToolCallGroupThemeClasses {
    /** Root container: "border-l-4 bg-white dark:bg-gray-900 mb-4 overflow-hidden" + dynamic border */
    root?: string;
    /** Header row: "flex items-center justify-between px-4 py-1.5 cursor-pointer ..." */
    header?: string;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: string;
    /** Status icon wrapper */
    statusIcon?: string;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: string;
    /** Tool summary badge: "text-xs text-purple-600 dark:text-purple-400 font-medium" */
    toolSummary?: string;
    /** Header right group: "flex items-center gap-1.5" */
    headerRight?: string;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: string;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: string;
    /** Items container: "px-4 py-1 space-y-0" (collapsed) or "group" (expanded) */
    itemList?: string;
    /** Individual item wrapper: "border-b border-gray-100 dark:border-gray-800 last:border-b-0" */
    item?: string;
    /** Item header row: "flex items-start gap-2 py-2 text-xs cursor-pointer ..." */
    itemHeader?: string;
    /** Tool name badge: "text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 ..." */
    toolBadge?: string;
    /** Expanded item content: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    itemContent?: string;
    /** Prose wrapper: "vprose prose prose-slate ... text-sm" */
    prose?: string;
    /** Technical details: "mt-3 text-xs border rounded p-2 bg-muted/30" */
    itemDetails?: string;
    /** File display container: "mt-2 flex flex-wrap gap-2" */
    fileDisplay?: string;
}

/** ToolCallGroup theme. */
export type ToolCallGroupTheme = ToolCallGroupThemeClasses;

const EMPTY: ToolCallGroupThemeClasses = {};

export function resolveToolCallGroupTheme(
    theme: ToolCallGroupTheme | undefined,
): ToolCallGroupThemeClasses {
    return theme ?? EMPTY;
}
