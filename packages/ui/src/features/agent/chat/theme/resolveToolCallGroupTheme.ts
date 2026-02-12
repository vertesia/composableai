import { type ClassTree, type ThemeClassValue, type ViewMode, buildClassChains, mergeResolvedLayer, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// ToolCallGroup theme classes (16 total)
// ---------------------------------------------------------------------------

/** Class overrides for individual ToolCallGroup DOM elements. */
export interface ToolCallGroupThemeClasses {
    /** Root container: "border-l-4 bg-white dark:bg-gray-900 mb-4 overflow-hidden" + dynamic border */
    root?: ThemeClassValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5 cursor-pointer ..." */
    header?: ThemeClassValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: ThemeClassValue;
    /** Status icon wrapper */
    statusIcon?: ThemeClassValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: ThemeClassValue;
    /** Tool summary badge: "text-xs text-purple-600 dark:text-purple-400 font-medium" */
    toolSummary?: ThemeClassValue;
    /** Header right group: "flex items-center gap-1.5" */
    headerRight?: ThemeClassValue;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: ThemeClassValue;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: ThemeClassValue;
    /** Items container: "px-4 py-1 space-y-0" (collapsed) or "group" (expanded) */
    itemList?: ThemeClassValue;
    /** Individual item wrapper: "border-b border-gray-100 dark:border-gray-800 last:border-b-0" */
    item?: ThemeClassValue;
    /** Item header row: "flex items-start gap-2 py-2 text-xs cursor-pointer ..." */
    itemHeader?: ThemeClassValue;
    /** Tool name badge: "text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 ..." */
    toolBadge?: ThemeClassValue;
    /** Expanded item content: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    itemContent?: ThemeClassValue;
    /** Prose wrapper: "vprose prose prose-slate ... text-sm" */
    prose?: ThemeClassValue;
    /** Technical details: "mt-3 text-xs border rounded p-2 bg-muted/30" */
    itemDetails?: ThemeClassValue;
    /** File display container: "mt-2 flex flex-wrap gap-2" */
    fileDisplay?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedToolCallGroupThemeClasses = { [K in keyof ToolCallGroupThemeClasses]?: string };

/** ToolCallGroup theme — no byType, but supports byViewMode. */
export interface ToolCallGroupTheme extends ToolCallGroupThemeClasses {
    byViewMode?: Partial<Record<ViewMode, ToolCallGroupThemeClasses>>;
}

// ---------------------------------------------------------------------------
// Cascade tree — ToolCallGroup DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof ToolCallGroupThemeClasses;

const TOOL_CALL_GROUP_TREE: ClassTree = {
    root: {
        header: {
            headerLeft: { statusIcon: {}, sender: {}, toolSummary: {} },
            headerRight: { timestamp: {}, copyButton: {} },
        },
        itemList: {},
        item: {
            itemHeader: { toolBadge: {} },
            itemContent: { prose: {}, itemDetails: {} },
        },
        fileDisplay: {},
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(TOOL_CALL_GROUP_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedToolCallGroupThemeClasses = {};

/**
 * Resolve a ToolCallGroupTheme into a flat set of class strings.
 * No byType — status-based styling stays in the component.
 */
export function resolveToolCallGroupTheme(
    theme: ToolCallGroupTheme | undefined,
    viewMode?: ViewMode,
): ResolvedToolCallGroupThemeClasses {
    if (!theme) return EMPTY;

    let resolved = resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveClasses<ClassKey>(theme.byViewMode[viewMode], CLASS_CHAINS, CLASS_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
