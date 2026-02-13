// ---------------------------------------------------------------------------
// StreamingMessage theme classes (12 slots)
// ---------------------------------------------------------------------------

/** Class overrides for individual StreamingMessage DOM elements. */
export interface StreamingMessageThemeClasses {
    /** Root container: "w-full max-w-full" */
    root?: string;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 border-l-purple-500 ..." */
    card?: string;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: string;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: string;
    /** Icon wrapper: "animate-fadeIn" */
    icon?: string;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: string;
    /** Workstream badge: "text-xs text-muted" */
    badge?: string;
    /** Header right group: "flex items-center gap-2 text-muted" */
    headerRight?: string;
    /** Timestamp: "text-[11px]" */
    timestamp?: string;
    /** Copy button: "size-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800" */
    copyButton?: string;
    /** Content section: "px-4 pb-3 streaming-content" */
    content?: string;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: string;
}

/** StreamingMessage theme. */
export type StreamingMessageTheme = StreamingMessageThemeClasses;

const EMPTY: StreamingMessageThemeClasses = {};

export function resolveStreamingMessageTheme(
    theme: StreamingMessageTheme | undefined,
): StreamingMessageThemeClasses {
    return theme ?? EMPTY;
}
