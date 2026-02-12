import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// ModernAgentConversation theme classes (7 total)
// ---------------------------------------------------------------------------

/** Class overrides for ModernAgentConversation layout. */
export interface ModernAgentConversationThemeClasses {
    /** Root layout: "flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden" */
    root?: ThemeClassValue;
    /** Conversation area: "flex flex-col min-h-0 border-0" + responsive width */
    conversationArea?: ThemeClassValue;
    /** Header wrapper: "flex-shrink-0" */
    headerWrapper?: ThemeClassValue;
    /** Header title section (bot icon + title + run ID): "flex flex-wrap items-center space-x-2" */
    headerTitle?: ThemeClassValue;
    /** Header actions section (view toggle, plan button, more menu): "flex justify-end items-center space-x-2 ml-auto" */
    headerActions?: ThemeClassValue;
    /** Empty state (no messages): "flex-1 flex flex-col items-center justify-center ..." */
    emptyState?: ThemeClassValue;
    /** Input wrapper: "flex-shrink-0" */
    inputWrapper?: ThemeClassValue;
    /** Plan panel: "w-full lg:w-1/3 min-h-[50vh] lg:h-full border-t ..." */
    planPanel?: ThemeClassValue;
    /** Drag overlay: "absolute inset-0 ..." */
    dragOverlay?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedModernAgentConversationThemeClasses = { [K in keyof ModernAgentConversationThemeClasses]?: string };

/** ModernAgentConversation theme. */
export type ModernAgentConversationTheme = ModernAgentConversationThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — ModernAgentConversation DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof ModernAgentConversationThemeClasses;

const MODERN_AGENT_CONVERSATION_TREE: ClassTree = {
    root: {
        conversationArea: {
            headerWrapper: {
                headerTitle: {},
                headerActions: {},
            },
            emptyState: {},
            inputWrapper: {},
        },
        planPanel: {},
        dragOverlay: {},
    },
};

const CLASS_CHAINS = buildClassChains<ClassKey>(MODERN_AGENT_CONVERSATION_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedModernAgentConversationThemeClasses = {};

export function resolveModernAgentConversationTheme(
    theme: ModernAgentConversationTheme | undefined,
): ResolvedModernAgentConversationThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
