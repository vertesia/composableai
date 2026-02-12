import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// Header theme classes (24 total)
// ---------------------------------------------------------------------------

/** Class overrides for Header DOM elements. */
export interface HeaderThemeClasses {
    // -- Root & Title --
    /** Main container: "flex flex-wrap items-end justify-between py-1.5 px-2 border-b shadow-sm flex-shrink-0" */
    root?: ThemeClassValue;
    /** Title group: "flex flex-wrap items-center space-x-2" */
    titleSection?: ThemeClassValue;
    /** Bot icon + title wrapper: "flex items-center space-x-1" */
    iconContainer?: ThemeClassValue;
    /** Bot icon: "size-5 text-muted" */
    icon?: ThemeClassValue;
    /** Title text span: "font-medium" */
    title?: ThemeClassValue;
    /** Run ID container: "text-xs text-muted ml-1 flex items-center gap-1.5" */
    runId?: ThemeClassValue;
    /** Streaming chunk indicator: "w-2 h-2 rounded-full transition-colors duration-200" + dynamic color */
    streamingIndicator?: ThemeClassValue;

    // -- Actions --
    /** Actions group: "flex justify-end items-center space-x-2 ml-auto" */
    actionsSection?: ThemeClassValue;
    /** View mode toggle container: "flex items-center space-x-1 bg-muted rounded p-0.5 mt-2 lg:mt-0" */
    viewToggle?: ThemeClassValue;
    /** "Details" button: "rounded-l-md" */
    detailsButton?: ThemeClassValue;
    /** "Summary" button: "rounded-r-md" */
    summaryButton?: ThemeClassValue;
    /** Plan button wrapper: "relative" */
    planContainer?: ThemeClassValue;
    /** Plan notification badge: "absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-border z-10" */
    planBadge?: ThemeClassValue;
    /** Plan toggle button: "transition-all duration-200 rounded-md" */
    planButton?: ThemeClassValue;
    /** ClipboardList icon: "size-4 mr-1.5" */
    planButtonIcon?: ThemeClassValue;
    /** "Show/Hide Plan" text: "font-medium text-xs" */
    planButtonText?: ThemeClassValue;
    /** Close button (ghost variant) */
    closeButton?: ThemeClassValue;
    /** Close XIcon: "size-4" */
    closeButtonIcon?: ThemeClassValue;

    // -- Dropdown (MoreDropdown sub-component) --
    /** More actions trigger button (ghost variant) */
    moreButton?: ThemeClassValue;
    /** MoreVertical icon: "size-4" */
    moreButtonIcon?: ThemeClassValue;
    /** Dropdown container: "rounded-md shadow-lg z-50" */
    dropdownContent?: ThemeClassValue;
    /** "Actions" header: "flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300" */
    dropdownHeader?: ThemeClassValue;
    /** Each CommandItem: "text-xs" */
    dropdownItem?: ThemeClassValue;
    /** Item icons: "size-3.5 mr-2 text-muted" */
    dropdownItemIcon?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedHeaderThemeClasses = { [K in keyof HeaderThemeClasses]?: string };

/** Header theme — no byType or byViewMode. */
export type HeaderTheme = HeaderThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — Header DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof HeaderThemeClasses;

const HEADER_TREE: ClassTree = {
    root: {
        titleSection: {
            iconContainer: {
                icon: {},
                title: {},
            },
            runId: {
                streamingIndicator: {},
            },
        },
        actionsSection: {
            viewToggle: {
                detailsButton: {},
                summaryButton: {},
            },
            planContainer: {
                planBadge: {},
                planButton: {
                    planButtonIcon: {},
                    planButtonText: {},
                },
            },
            moreButton: {
                moreButtonIcon: {},
            },
            dropdownContent: {
                dropdownHeader: {},
                dropdownItem: {
                    dropdownItemIcon: {},
                },
            },
            closeButton: {
                closeButtonIcon: {},
            },
        },
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(HEADER_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedHeaderThemeClasses = {};

/**
 * Resolve a HeaderTheme into a flat set of class strings.
 */
export function resolveHeaderTheme(
    theme: HeaderTheme | undefined,
): ResolvedHeaderThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
