import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// AllMessagesMixed theme classes (5 total)
// ---------------------------------------------------------------------------

/** Class overrides for AllMessagesMixed layout container. */
export interface AllMessagesMixedThemeClasses {
    /** Root scroll container: "flex-1 min-h-0 h-full w-full ... overflow-y-auto ... flex flex-col ..." */
    root?: ThemeClassValue;
    /** Workstream tabs wrapper: "sticky top-0 z-10" */
    tabsWrapper?: ThemeClassValue;
    /** Empty state: "flex items-center justify-center h-full text-center py-8" */
    emptyState?: ThemeClassValue;
    /** Message list container: "flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full" */
    messageList?: ThemeClassValue;
    /** Working indicator: "flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500" */
    workingIndicator?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedAllMessagesMixedThemeClasses = { [K in keyof AllMessagesMixedThemeClasses]?: string };

/** AllMessagesMixed theme — no byType. */
export type AllMessagesMixedTheme = AllMessagesMixedThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — AllMessagesMixed DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof AllMessagesMixedThemeClasses;

const ALL_MESSAGES_MIXED_TREE: ClassTree = {
    root: {
        tabsWrapper: {},
        emptyState: {},
        messageList: {},
        workingIndicator: {},
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(ALL_MESSAGES_MIXED_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedAllMessagesMixedThemeClasses = {};

/**
 * Resolve an AllMessagesMixedTheme into a flat set of class strings.
 */
export function resolveAllMessagesMixedTheme(
    theme: AllMessagesMixedTheme | undefined,
): ResolvedAllMessagesMixedThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
