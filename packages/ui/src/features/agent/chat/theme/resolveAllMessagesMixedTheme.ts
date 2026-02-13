// ---------------------------------------------------------------------------
// AllMessagesMixed theme classes (7 slots)
// ---------------------------------------------------------------------------

/** Class overrides for AllMessagesMixed layout container. */
export interface AllMessagesMixedThemeClasses {
    /** Root scroll container: "flex-1 min-h-0 h-full w-full ... overflow-y-auto ... flex flex-col ..." */
    root?: string;
    /** Workstream tabs wrapper: "sticky top-0 z-10" */
    tabsWrapper?: string;
    /** Empty state: "flex items-center justify-center h-full text-center py-8" */
    emptyState?: string;
    /** Message list container: "flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full" */
    messageList?: string;
    /** Working indicator container: "flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500" */
    workingIndicator?: string;
    /** Working indicator pulsating circle wrapper */
    workingIndicatorIcon?: string;
    /** Working indicator text: "text-sm text-muted" */
    workingIndicatorText?: string;
}

/** AllMessagesMixed theme. */
export type AllMessagesMixedTheme = AllMessagesMixedThemeClasses;

const EMPTY: AllMessagesMixedThemeClasses = {};

export function resolveAllMessagesMixedTheme(
    theme: AllMessagesMixedTheme | undefined,
): AllMessagesMixedThemeClasses {
    return theme ?? EMPTY;
}
