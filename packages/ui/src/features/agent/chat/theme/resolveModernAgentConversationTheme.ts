// ---------------------------------------------------------------------------
// ModernAgentConversation theme classes (4 slots)
// ---------------------------------------------------------------------------

/** Class overrides for ModernAgentConversation layout. */
export interface ModernAgentConversationThemeClasses {
    /** Root layout: "flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden" */
    root?: string;
    /** Conversation area: "flex flex-col min-h-0 border-0" + responsive width */
    conversationArea?: string;
    /** Empty state (no messages): "flex-1 flex flex-col items-center justify-center ..." */
    emptyState?: string;
    /** Drag overlay: "absolute inset-0 ..." */
    dragOverlay?: string;
}

/** ModernAgentConversation theme. */
export type ModernAgentConversationTheme = ModernAgentConversationThemeClasses;

const EMPTY: ModernAgentConversationThemeClasses = {};

export function resolveModernAgentConversationTheme(
    theme: ModernAgentConversationTheme | undefined,
): ModernAgentConversationThemeClasses {
    return theme ?? EMPTY;
}
