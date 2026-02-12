import { type AgentMessageType } from "@vertesia/common";
import { createContext, createElement, useContext, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// SlotValue — controls cascade vs self-only styling
// ---------------------------------------------------------------------------

/**
 * A theme slot value. Strings cascade to all descendants (backward compatible).
 * Use an object to control cascade vs self-only:
 *
 * ```ts
 * root: "font-mono"                                    // cascades to all
 * root: { self: "border rounded-lg" }                  // root only, no cascade
 * root: { cascade: "font-mono", self: "border" }       // root gets both, children get font-mono
 * ```
 */
export type SlotValue = string | {
    /** Classes that cascade to this element AND all descendants */
    cascade?: string;
    /** Classes that apply ONLY to this element, do NOT cascade */
    self?: string;
};

// ---------------------------------------------------------------------------
// MessageItem theme slots — one per DOM element (22 total)
// ---------------------------------------------------------------------------

/** Class overrides for individual MessageItem DOM elements. */
export interface MessageItemSlots {
    /** Root container: "w-full max-w-full" */
    root?: SlotValue;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 ..." */
    card?: SlotValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: SlotValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: SlotValue;
    /** Icon wrapper */
    icon?: SlotValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: SlotValue;
    /** Workstream badge: "text-xs text-muted ml-1" */
    badge?: SlotValue;
    /** Header right group: "flex items-center gap-1.5 print:hidden" */
    headerRight?: SlotValue;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: SlotValue;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: SlotValue;
    /** Export button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    exportButton?: SlotValue;
    /** Content section: "px-4 pb-3 bg-white dark:bg-gray-900 overflow-hidden" */
    content?: SlotValue;
    /** Message body wrapper: "message-content break-words w-full" */
    body?: SlotValue;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: SlotValue;
    /** JSON pre block: "text-xs font-mono ..." */
    jsonPre?: SlotValue;
    /** Artifacts container: "mt-3 text-xs" */
    artifacts?: SlotValue;
    /** Artifacts label: "font-medium text-muted mb-1" */
    artifactsLabel?: SlotValue;
    /** Image previews wrapper: "mb-2 flex flex-wrap gap-3" */
    artifactImages?: SlotValue;
    /** Artifact download buttons wrapper: "flex flex-wrap gap-2 print:hidden" */
    artifactButtons?: SlotValue;
    /** Details section: "mt-2 print:hidden" */
    details?: SlotValue;
    /** Details toggle button: "text-xs text-muted flex items-center" */
    detailsToggle?: SlotValue;
    /** Details content panel: "mt-2 p-2 bg-muted ..." */
    detailsContent?: SlotValue;
}

/** Resolved slots — always flat strings after cascade + byType resolution. */
export type ResolvedMessageItemSlots = { [K in keyof MessageItemSlots]?: string };

/**
 * Full MessageItem theme: base slots that cascade to all messages,
 * plus per-type overrides that take highest priority.
 *
 * Slots cascade down the DOM tree (root → card → header → icon, etc.).
 * Type overrides layer on top of the base cascade.
 *
 * Use `resolveMessageItemTheme()` to fold cascade + byType into a
 * flat resolved object for consumption in the component.
 */
export interface MessageItemTheme extends MessageItemSlots {
    /**
     * Per-message-type overrides keyed by AgentMessageType enum value.
     * These cascade identically to base slots but at higher priority.
     */
    byType?: Partial<Record<AgentMessageType, MessageItemSlots>>;
}

// ---------------------------------------------------------------------------
// Stub interfaces for Phase 2+ components
// ---------------------------------------------------------------------------

/** Class overrides for individual StreamingMessage DOM elements. */
export interface StreamingMessageSlots {
    /** Root container: "w-full max-w-full" */
    root?: SlotValue;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 border-l-purple-500 ..." */
    card?: SlotValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: SlotValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: SlotValue;
    /** Icon wrapper: "animate-fadeIn" */
    icon?: SlotValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: SlotValue;
    /** Workstream badge: "text-xs text-muted" */
    badge?: SlotValue;
    /** Header right group: "flex items-center gap-2 text-muted" */
    headerRight?: SlotValue;
    /** Timestamp: "text-[11px]" */
    timestamp?: SlotValue;
    /** Copy button: "size-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800" */
    copyButton?: SlotValue;
    /** Content section: "px-4 pb-3 streaming-content" */
    content?: SlotValue;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedStreamingMessageSlots = { [K in keyof StreamingMessageSlots]?: string };

/** StreamingMessage theme — no byType (always one visual variant). */
export type StreamingMessageTheme = StreamingMessageSlots;

export interface ToolCallGroupTheme {
    root?: string;
    card?: string;
    header?: string;
}

export interface BatchProgressPanelTheme {
    root?: string;
    header?: string;
    progressBar?: string;
}

// ---------------------------------------------------------------------------
// Top-level conversation theme
// ---------------------------------------------------------------------------

export interface ConversationTheme {
    messageItem?: MessageItemTheme;
    streamingMessage?: StreamingMessageTheme;
    toolCallGroup?: ToolCallGroupTheme;
    batchProgressPanel?: BatchProgressPanelTheme;
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
