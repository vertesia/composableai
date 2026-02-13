import { createContext, createElement, useContext, type ReactNode } from "react";
import { type AllMessagesMixedTheme } from "./resolveAllMessagesMixedTheme";
import { type BatchProgressPanelTheme } from "./resolveBatchProgressPanelTheme";
import { type MessageItemTheme } from "./resolveMessageItemTheme";
import { type ModernAgentConversationTheme } from "./resolveModernAgentConversationTheme";
import { type StreamingMessageTheme } from "./resolveStreamingMessageTheme";
import { type ToolCallGroupTheme } from "./resolveToolCallGroupTheme";
import { type WorkstreamTabsTheme } from "./resolveWorkstreamTabsTheme";

import { type ViewMode } from "./themeUtils";

// Re-export shared primitives so existing imports from this module still work
export { type ViewMode } from "./themeUtils";

// ---------------------------------------------------------------------------
// Top-level conversation theme
// ---------------------------------------------------------------------------

export interface ConversationTheme {
    /** Current view mode. Set internally by ModernAgentConversation — do not set externally. */
    viewMode?: ViewMode;
    conversation?: ModernAgentConversationTheme;
    messageItem?: MessageItemTheme;
    streamingMessage?: StreamingMessageTheme;
    toolCallGroup?: ToolCallGroupTheme;
    batchProgressPanel?: BatchProgressPanelTheme;
    allMessagesMixed?: AllMessagesMixedTheme;
    workstreamTabs?: WorkstreamTabsTheme;
    /** Raw CSS string injected after the default .vprose styles. Overrides markdown rendering. */
    markdownStyles?: string;
}

// ---------------------------------------------------------------------------
// Context, Provider, and Hook
// ---------------------------------------------------------------------------

const ConversationThemeContext = createContext<ConversationTheme | undefined>(undefined);

export { ConversationThemeContext };

export interface ConversationThemeProviderProps {
    theme: ConversationTheme;
    children: ReactNode;
}

export function ConversationThemeProvider({ theme, children }: ConversationThemeProviderProps) {
    return createElement(ConversationThemeContext.Provider, { value: theme }, children);
}

export function useConversationTheme(): ConversationTheme | undefined {
    return useContext(ConversationThemeContext);
}
