import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// WorkstreamTabs theme classes (9 total)
// ---------------------------------------------------------------------------

/** Class overrides for WorkstreamTabs. */
export interface WorkstreamTabsThemeClasses {
    /** Root container: "flex overflow-x-auto space-x-1 mb-2 bg-muted ..." */
    root?: ThemeClassValue;
    /** Tab button base (all tabs): "px-2 py-1 text-xs font-medium whitespace-nowrap ..." */
    tab?: ThemeClassValue;
    /** Active tab override: "bg-info text-info border-b-2 border-info" */
    tabActive?: ThemeClassValue;
    /** Inactive tab override: "text-muted hover:bg-muted border-b-2 border-transparent" */
    tabInactive?: ThemeClassValue;
    /** Badge group wrapper (badge + completion icon): "flex items-center space-x-1" */
    badgeGroup?: ThemeClassValue;
    /** Count badge base (all badges): "inline-flex items-center justify-center p-1 text-xs rounded-full" */
    badge?: ThemeClassValue;
    /** Active badge override: "bg-info text-info" */
    badgeActive?: ThemeClassValue;
    /** Inactive badge override: "bg-muted text-muted" */
    badgeInactive?: ThemeClassValue;
    /** Empty state (no workstreams): "py-1" */
    empty?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedWorkstreamTabsThemeClasses = { [K in keyof WorkstreamTabsThemeClasses]?: string };

/** WorkstreamTabs theme — no byType. */
export type WorkstreamTabsTheme = WorkstreamTabsThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — WorkstreamTabs DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof WorkstreamTabsThemeClasses;

const WORKSTREAM_TABS_TREE: ClassTree = {
    root: {
        tab: {
            tabActive: {},
            tabInactive: {},
            badgeGroup: {
                badge: {
                    badgeActive: {},
                    badgeInactive: {},
                },
            },
        },
        empty: {},
    },
};

const CLASS_CHAINS = buildClassChains<ClassKey>(WORKSTREAM_TABS_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedWorkstreamTabsThemeClasses = {};

export function resolveWorkstreamTabsTheme(
    theme: WorkstreamTabsTheme | undefined,
): ResolvedWorkstreamTabsThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
