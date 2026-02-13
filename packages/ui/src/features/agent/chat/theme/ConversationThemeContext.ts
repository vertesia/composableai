import { createContext, createElement, useContext, type ReactNode } from "react";
import { type BatchProgressPanelTheme } from "./resolveBatchProgressPanelTheme";
import { type ModernAgentConversationTheme } from "./resolveModernAgentConversationTheme";
import { type WorkstreamTabsTheme } from "./resolveWorkstreamTabsTheme";

export type ViewMode = "stacked" | "sliding";

// ---------------------------------------------------------------------------
// Top-level conversation theme
// ---------------------------------------------------------------------------

export interface ConversationTheme {
    /** Current view mode. Set internally by ModernAgentConversation — do not set externally. */
    viewMode?: ViewMode;
    conversation?: ModernAgentConversationTheme;
    batchProgressPanel?: BatchProgressPanelTheme;
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
