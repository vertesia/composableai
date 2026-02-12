import { type AgentMessageType } from "@vertesia/common";
import { cn } from "@vertesia/ui/core";
import { type ClassTree, type ThemeClassValue, type ViewMode, buildClassChains, getCascade, getSelf, mergeResolvedLayer, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// MessageItem theme classes — one per DOM element (22 total)
// ---------------------------------------------------------------------------

/** Class overrides for individual MessageItem DOM elements. */
export interface MessageItemThemeClasses {
    /** Root container: "w-full max-w-full" */
    root?: ThemeClassValue;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 ..." */
    card?: ThemeClassValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: ThemeClassValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: ThemeClassValue;
    /** Icon wrapper */
    icon?: ThemeClassValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: ThemeClassValue;
    /** Workstream badge: "text-xs text-muted ml-1" */
    badge?: ThemeClassValue;
    /** Header right group: "flex items-center gap-1.5 print:hidden" */
    headerRight?: ThemeClassValue;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: ThemeClassValue;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: ThemeClassValue;
    /** Export button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    exportButton?: ThemeClassValue;
    /** Content section: "px-4 pb-3 bg-white dark:bg-gray-900 overflow-hidden" */
    content?: ThemeClassValue;
    /** Message body wrapper: "message-content break-words w-full" */
    body?: ThemeClassValue;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: ThemeClassValue;
    /** JSON pre block: "text-xs font-mono ..." */
    jsonPre?: ThemeClassValue;
    /** Artifacts container: "mt-3 text-xs" */
    artifacts?: ThemeClassValue;
    /** Artifacts label: "font-medium text-muted mb-1" */
    artifactsLabel?: ThemeClassValue;
    /** Image previews wrapper: "mb-2 flex flex-wrap gap-3" */
    artifactImages?: ThemeClassValue;
    /** Artifact download buttons wrapper: "flex flex-wrap gap-2 print:hidden" */
    artifactButtons?: ThemeClassValue;
    /** Details section: "mt-2 print:hidden" */
    details?: ThemeClassValue;
    /** Details toggle button: "text-xs text-muted flex items-center" */
    detailsToggle?: ThemeClassValue;
    /** Details content panel: "mt-2 p-2 bg-muted ..." */
    detailsContent?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade + byType resolution. */
export type ResolvedMessageItemThemeClasses = { [K in keyof MessageItemThemeClasses]?: string };

/**
 * Full MessageItem theme: base classes that cascade to all messages,
 * plus per-type overrides that take highest priority.
 *
 * Classes cascade down the DOM tree (root → card → header → icon, etc.).
 * Type overrides layer on top of the base cascade.
 *
 * Use `resolveMessageItemTheme()` to fold cascade + byType into a
 * flat resolved object for consumption in the component.
 */
export interface MessageItemTheme extends MessageItemThemeClasses {
    /**
     * Per-message-type overrides keyed by AgentMessageType enum value.
     * These cascade identically to base classes but at higher priority.
     */
    byType?: Partial<Record<AgentMessageType, MessageItemThemeClasses>>;
    /** Per-view-mode overrides. Highest priority — layers on top of base + byType. */
    byViewMode?: Partial<Record<ViewMode, MessageItemThemeClasses>>;
}

// ---------------------------------------------------------------------------
// Cascade tree — defines the DOM hierarchy. Chains are derived automatically.
// ---------------------------------------------------------------------------

type ClassKey = keyof MessageItemThemeClasses;

/** MessageItem DOM hierarchy — single source of truth for cascade relationships. */
const MESSAGE_ITEM_TREE: ClassTree = {
    root: {
        card: {
            header: {
                headerLeft: { icon: {}, sender: {}, badge: {} },
                headerRight: { timestamp: {}, copyButton: {}, exportButton: {} },
            },
            content: { body: { prose: {} }, jsonPre: {} },
            artifacts: { artifactsLabel: {}, artifactImages: {}, artifactButtons: {} },
            details: { detailsToggle: {}, detailsContent: {} },
        },
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(MESSAGE_ITEM_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedMessageItemThemeClasses = {};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a MessageItemTheme into a flat set of class strings.
 *
 * For each class key, the resolved value is built by walking the ancestor chain:
 *   - Ancestors contribute only their `cascade` part
 *   - Self contributes both `cascade` and `self`
 *   - Base cascade runs first (lower priority), then type cascade (higher)
 *
 * Returns undefined per key when nothing is set — cn() will ignore it.
 */
export function resolveMessageItemTheme(
    theme: MessageItemTheme | undefined,
    messageType: AgentMessageType,
    viewMode?: ViewMode,
): ResolvedMessageItemThemeClasses {
    if (!theme) return EMPTY;

    const typeOverrides = theme.byType?.[messageType];
    let resolved: ResolvedMessageItemThemeClasses = {};

    for (const key of CLASS_KEYS) {
        const chain = CLASS_CHAINS[key];
        const values: (string | undefined)[] = [];

        // Base cascade (lower priority)
        for (const ancestor of chain) {
            values.push(getCascade(theme[ancestor]));
            if (ancestor === key) {
                values.push(getSelf(theme[ancestor]));
            }
        }

        // Type-specific cascade (higher priority)
        if (typeOverrides) {
            for (const ancestor of chain) {
                values.push(getCascade(typeOverrides[ancestor]));
                if (ancestor === key) {
                    values.push(getSelf(typeOverrides[ancestor]));
                }
            }
        }

        const merged = cn(...values);
        if (merged) {
            resolved[key] = merged;
        }
    }

    // ViewMode-specific cascade (highest priority)
    if (viewMode && theme.byViewMode?.[viewMode]) {
        const vmResolved = resolveClasses<ClassKey>(theme.byViewMode[viewMode], CLASS_CHAINS, CLASS_KEYS);
        resolved = mergeResolvedLayer(resolved, vmResolved);
    }

    return resolved;
}
