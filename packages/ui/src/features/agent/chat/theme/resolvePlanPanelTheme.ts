import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// PlanPanel theme classes (17 total)
// ---------------------------------------------------------------------------

/** Class overrides for InlineSlidingPlanPanel. */
export interface PlanPanelThemeClasses {
    /** Root: "h-full shadow-xl border border-muted/20 overflow-hidden" */
    root?: ThemeClassValue;
    /** Header: "flex items-center justify-between p-3 border-b border-muted/20" */
    header?: ThemeClassValue;
    /** Title: "font-bold text-base" */
    title?: ThemeClassValue;
    /** Scrollable content area: "p-3 overflow-y-auto" */
    scrollContent?: ThemeClassValue;
    /** Task progress section: "mb-3 p-2 bg-info rounded-md border border-info" */
    taskProgress?: ThemeClassValue;
    /** Progress title: "text-xs font-medium text-info mb-1" */
    progressTitle?: ThemeClassValue;
    /** Progress bar track: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5" */
    progressTrack?: ThemeClassValue;
    /** Progress count: "text-xs text-foreground font-medium whitespace-nowrap" */
    progressCount?: ThemeClassValue;
    /** Plan selector: "mb-3 flex items-center justify-between" */
    planSelector?: ThemeClassValue;
    /** Steps container: "rounded-md border border-muted/30" */
    stepsContainer?: ThemeClassValue;
    /** Steps header: "p-2 border-b border-muted/30 bg-muted" */
    stepsHeader?: ThemeClassValue;
    /** Steps list: "divide-y divide-muted/20 max-h-[calc(100vh-350px)] overflow-y-auto" */
    stepsList?: ThemeClassValue;
    /** Individual step item: "flex p-3 my-1" */
    stepItem?: ThemeClassValue;
    /** Empty state (no plan): "p-3 text-center text-muted italic" */
    stepsEmpty?: ThemeClassValue;
    /** Workstreams section: "mt-3 rounded-md border border-gray-200 dark:border-gray-800" */
    workstreams?: ThemeClassValue;
    /** Workstreams header: "p-2 border-b ... bg-gray-50 dark:bg-gray-900/50" */
    workstreamsHeader?: ThemeClassValue;
    /** Individual workstream item: "flex items-center p-1.5 rounded" + dynamic statusBg */
    workstreamItem?: ThemeClassValue;
}

/** Resolved theme classes. */
export type ResolvedPlanPanelThemeClasses = { [K in keyof PlanPanelThemeClasses]?: string };

/** PlanPanel theme. */
export type PlanPanelTheme = PlanPanelThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — PlanPanel DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof PlanPanelThemeClasses;

const PLAN_PANEL_TREE: ClassTree = {
    root: {
        header: { title: {} },
        scrollContent: {
            taskProgress: { progressTitle: {}, progressTrack: {}, progressCount: {} },
            planSelector: {},
            stepsContainer: {
                stepsHeader: {},
                stepsList: { stepItem: {} },
                stepsEmpty: {},
            },
            workstreams: {
                workstreamsHeader: {},
                workstreamItem: {},
            },
        },
    },
};

const CLASS_CHAINS = buildClassChains<ClassKey>(PLAN_PANEL_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedPlanPanelThemeClasses = {};

export function resolvePlanPanelTheme(
    theme: PlanPanelTheme | undefined,
): ResolvedPlanPanelThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
