import { type ClassTree, type ThemeClassValue, type ViewMode, buildClassChains, mergeResolvedLayer, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// StreamingMessage theme classes (12 total)
// ---------------------------------------------------------------------------

/** Class overrides for individual StreamingMessage DOM elements. */
export interface StreamingMessageThemeClasses {
    /** Root container: "w-full max-w-full" */
    root?: ThemeClassValue;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 border-l-purple-500 ..." */
    card?: ThemeClassValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: ThemeClassValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: ThemeClassValue;
    /** Icon wrapper: "animate-fadeIn" */
    icon?: ThemeClassValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: ThemeClassValue;
    /** Workstream badge: "text-xs text-muted" */
    badge?: ThemeClassValue;
    /** Header right group: "flex items-center gap-2 text-muted" */
    headerRight?: ThemeClassValue;
    /** Timestamp: "text-[11px]" */
    timestamp?: ThemeClassValue;
    /** Copy button: "size-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800" */
    copyButton?: ThemeClassValue;
    /** Content section: "px-4 pb-3 streaming-content" */
    content?: ThemeClassValue;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedStreamingMessageThemeClasses = { [K in keyof StreamingMessageThemeClasses]?: string };

/** StreamingMessage theme — no byType, but supports byViewMode. */
export interface StreamingMessageTheme extends StreamingMessageThemeClasses {
    byViewMode?: Partial<Record<ViewMode, StreamingMessageThemeClasses>>;
}

// ---------------------------------------------------------------------------
// Cascade tree — StreamingMessage DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof StreamingMessageThemeClasses;

const STREAMING_MESSAGE_TREE: ClassTree = {
    root: {
        card: {
            header: {
                headerLeft: { icon: {}, sender: {}, badge: {} },
                headerRight: { timestamp: {}, copyButton: {} },
            },
            content: { prose: {} },
        },
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(STREAMING_MESSAGE_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedStreamingMessageThemeClasses = {};

/**
 * Resolve a StreamingMessageTheme into a flat set of class strings.
 */
export function resolveStreamingMessageTheme(
    theme: StreamingMessageTheme | undefined,
    viewMode?: ViewMode,
): ResolvedStreamingMessageThemeClasses {
    if (!theme) return EMPTY;

    let resolved = resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);

    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveClasses<ClassKey>(theme.byViewMode[viewMode], CLASS_CHAINS, CLASS_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
