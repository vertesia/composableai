// ---------------------------------------------------------------------------
// WorkstreamTabs theme classes (9 slots)
// ---------------------------------------------------------------------------

/** Class overrides for WorkstreamTabs. */
export interface WorkstreamTabsThemeClasses {
    /** Root container: "flex overflow-x-auto space-x-1 mb-2 bg-muted ..." */
    root?: string;
    /** Tab button base (all tabs): "px-2 py-1 text-xs font-medium whitespace-nowrap ..." */
    tab?: string;
    /** Active tab override: "bg-info text-info border-b-2 border-info" */
    tabActive?: string;
    /** Inactive tab override: "text-muted hover:bg-muted border-b-2 border-transparent" */
    tabInactive?: string;
    /** Badge group wrapper (badge + completion icon): "flex items-center space-x-1" */
    badgeGroup?: string;
    /** Count badge base (all badges): "inline-flex items-center justify-center p-1 text-xs rounded-full" */
    badge?: string;
    /** Active badge override: "bg-info text-info" */
    badgeActive?: string;
    /** Inactive badge override: "bg-muted text-muted" */
    badgeInactive?: string;
    /** Empty state (no workstreams): "py-1" */
    empty?: string;
}

/** WorkstreamTabs theme. */
export type WorkstreamTabsTheme = WorkstreamTabsThemeClasses;

const EMPTY: WorkstreamTabsThemeClasses = {};

export function resolveWorkstreamTabsTheme(
    theme: WorkstreamTabsTheme | undefined,
): WorkstreamTabsThemeClasses {
    return theme ?? EMPTY;
}
