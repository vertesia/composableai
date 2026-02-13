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
    /** Empty state (no messages): "flex-1 flex flex-col items-center justify-center ..." */
    emptyState?: ThemeClassValue;
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
            emptyState: {},
        },
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
