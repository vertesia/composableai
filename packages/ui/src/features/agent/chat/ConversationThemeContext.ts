import { type AgentMessageType } from "@vertesia/common";
import { createContext, createElement, useContext, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ViewMode — stacked (detail) vs sliding (important-only)
// ---------------------------------------------------------------------------

export type ViewMode = "stacked" | "sliding";

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
    /** Per-view-mode overrides. Highest priority — layers on top of base + byType. */
    byViewMode?: Partial<Record<ViewMode, MessageItemSlots>>;
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

/** StreamingMessage theme — no byType, but supports byViewMode. */
export interface StreamingMessageTheme extends StreamingMessageSlots {
    byViewMode?: Partial<Record<ViewMode, StreamingMessageSlots>>;
}

/** Class overrides for individual ToolCallGroup DOM elements. */
export interface ToolCallGroupSlots {
    /** Root container: "border-l-4 bg-white dark:bg-gray-900 mb-4 overflow-hidden" + dynamic border */
    root?: SlotValue;
    /** Header row: "flex items-center justify-between px-4 py-1.5 cursor-pointer ..." */
    header?: SlotValue;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: SlotValue;
    /** Status icon wrapper */
    statusIcon?: SlotValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: SlotValue;
    /** Tool summary badge: "text-xs text-purple-600 dark:text-purple-400 font-medium" */
    toolSummary?: SlotValue;
    /** Header right group: "flex items-center gap-1.5" */
    headerRight?: SlotValue;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: SlotValue;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: SlotValue;
    /** Items container: "px-4 py-1 space-y-0" (collapsed) or "group" (expanded) */
    itemList?: SlotValue;
    /** Individual item wrapper: "border-b border-gray-100 dark:border-gray-800 last:border-b-0" */
    item?: SlotValue;
    /** Item header row: "flex items-start gap-2 py-2 text-xs cursor-pointer ..." */
    itemHeader?: SlotValue;
    /** Tool name badge: "text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 ..." */
    toolBadge?: SlotValue;
    /** Expanded item content: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    itemContent?: SlotValue;
    /** Prose wrapper: "vprose prose prose-slate ... text-sm" */
    prose?: SlotValue;
    /** Technical details: "mt-3 text-xs border rounded p-2 bg-muted/30" */
    itemDetails?: SlotValue;
    /** File display container: "mt-2 flex flex-wrap gap-2" */
    fileDisplay?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedToolCallGroupSlots = { [K in keyof ToolCallGroupSlots]?: string };

/** ToolCallGroup theme — no byType, but supports byViewMode. */
export interface ToolCallGroupTheme extends ToolCallGroupSlots {
    byViewMode?: Partial<Record<ViewMode, ToolCallGroupSlots>>;
}

/** Class overrides for individual BatchProgressPanel DOM elements. */
export interface BatchProgressPanelSlots {
    /** Root container: "border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5" */
    root?: SlotValue;
    /** Header row: "flex items-center justify-between px-4 py-2 ... bg-blue-50/50 ..." */
    header?: SlotValue;
    /** Header left group: "flex items-center gap-2" */
    headerLeft?: SlotValue;
    /** Status icon wrapper */
    statusIcon?: SlotValue;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: SlotValue;
    /** Tool name: "text-xs text-blue-600 dark:text-blue-400 font-medium" */
    toolName?: SlotValue;
    /** Progress count: "text-xs text-muted" */
    progressCount?: SlotValue;
    /** Header right group: "flex items-center gap-2" */
    headerRight?: SlotValue;
    /** Timestamp/duration: "text-xs text-muted" */
    timestamp?: SlotValue;
    /** Copy button: "text-muted" */
    copyButton?: SlotValue;
    /** Progress bar section: "px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30" */
    progressBar?: SlotValue;
    /** Progress bar track: "flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" */
    track?: SlotValue;
    /** Status counters: "flex items-center gap-2 text-xs" */
    counters?: SlotValue;
    /** Item list container: "max-h-64 overflow-y-auto" */
    itemList?: SlotValue;
    /** Individual item row: "flex items-center gap-2 px-4 py-1.5 text-xs border-b ..." */
    item?: SlotValue;
    /** Summary message: "px-4 py-2 text-xs text-muted" */
    summary?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedBatchProgressPanelSlots = { [K in keyof BatchProgressPanelSlots]?: string };

/** BatchProgressPanel theme — no byType, but supports byViewMode. */
export interface BatchProgressPanelTheme extends BatchProgressPanelSlots {
    byViewMode?: Partial<Record<ViewMode, BatchProgressPanelSlots>>;
}

/** Class overrides for AllMessagesMixed layout container. */
export interface AllMessagesMixedSlots {
    /** Root scroll container: "flex-1 min-h-0 h-full w-full ... overflow-y-auto ... flex flex-col ..." */
    root?: SlotValue;
    /** Workstream tabs wrapper: "sticky top-0 z-10" */
    tabsWrapper?: SlotValue;
    /** Empty state: "flex items-center justify-center h-full text-center py-8" */
    emptyState?: SlotValue;
    /** Message list container: "flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full" */
    messageList?: SlotValue;
    /** Working indicator: "flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500" */
    workingIndicator?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedAllMessagesMixedSlots = { [K in keyof AllMessagesMixedSlots]?: string };

/** AllMessagesMixed theme — no byType. */
export type AllMessagesMixedTheme = AllMessagesMixedSlots;

/** Class overrides for WorkstreamTabs. */
export interface WorkstreamTabsSlots {
    /** Root container: "flex overflow-x-auto space-x-1 mb-2 bg-muted ..." */
    root?: SlotValue;
    /** Tab button base (all tabs): "px-2 py-1 text-xs font-medium whitespace-nowrap ..." */
    tab?: SlotValue;
    /** Active tab override: "bg-info text-info border-b-2 border-info" */
    tabActive?: SlotValue;
    /** Inactive tab override: "text-muted hover:bg-muted border-b-2 border-transparent" */
    tabInactive?: SlotValue;
    /** Badge group wrapper (badge + completion icon): "flex items-center space-x-1" */
    badgeGroup?: SlotValue;
    /** Count badge base (all badges): "inline-flex items-center justify-center p-1 text-xs rounded-full" */
    badge?: SlotValue;
    /** Active badge override: "bg-info text-info" */
    badgeActive?: SlotValue;
    /** Inactive badge override: "bg-muted text-muted" */
    badgeInactive?: SlotValue;
    /** Empty state (no workstreams): "py-1" */
    empty?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedWorkstreamTabsSlots = { [K in keyof WorkstreamTabsSlots]?: string };

/** WorkstreamTabs theme — no byType. */
export type WorkstreamTabsTheme = WorkstreamTabsSlots;

/** Class overrides for ModernAgentConversation layout. */
export interface ModernAgentConversationSlots {
    /** Root layout: "flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden" */
    root?: SlotValue;
    /** Conversation area: "flex flex-col min-h-0 border-0" + responsive width */
    conversationArea?: SlotValue;
    /** Header wrapper: "flex-shrink-0" */
    headerWrapper?: SlotValue;
    /** Empty state (no messages): "flex-1 flex flex-col items-center justify-center ..." */
    emptyState?: SlotValue;
    /** Input wrapper: "flex-shrink-0" */
    inputWrapper?: SlotValue;
    /** Plan panel: "w-full lg:w-1/3 min-h-[50vh] lg:h-full border-t ..." */
    planPanel?: SlotValue;
    /** Drag overlay: "absolute inset-0 ..." */
    dragOverlay?: SlotValue;
}

/** Resolved slots — always flat strings after cascade resolution. */
export type ResolvedModernAgentConversationSlots = { [K in keyof ModernAgentConversationSlots]?: string };

/** ModernAgentConversation theme. */
export type ModernAgentConversationTheme = ModernAgentConversationSlots;

/** Class overrides for InlineSlidingPlanPanel. */
export interface PlanPanelSlots {
    /** Root: "h-full shadow-xl border border-muted/20 overflow-hidden" */
    root?: SlotValue;
    /** Header: "flex items-center justify-between p-3 border-b border-muted/20" */
    header?: SlotValue;
    /** Title: "font-bold text-base" */
    title?: SlotValue;
    /** Scrollable content area: "p-3 overflow-y-auto" */
    scrollContent?: SlotValue;
    /** Task progress section: "mb-3 p-2 bg-info rounded-md border border-info" */
    taskProgress?: SlotValue;
    /** Progress title: "text-xs font-medium text-info mb-1" */
    progressTitle?: SlotValue;
    /** Progress bar track: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5" */
    progressTrack?: SlotValue;
    /** Progress count: "text-xs text-foreground font-medium whitespace-nowrap" */
    progressCount?: SlotValue;
    /** Plan selector: "mb-3 flex items-center justify-between" */
    planSelector?: SlotValue;
    /** Steps container: "rounded-md border border-muted/30" */
    stepsContainer?: SlotValue;
    /** Steps header: "p-2 border-b border-muted/30 bg-muted" */
    stepsHeader?: SlotValue;
    /** Steps list: "divide-y divide-muted/20 max-h-[calc(100vh-350px)] overflow-y-auto" */
    stepsList?: SlotValue;
    /** Individual step item: "flex p-3 my-1" */
    stepItem?: SlotValue;
    /** Empty state (no plan): "p-3 text-center text-muted italic" */
    stepsEmpty?: SlotValue;
    /** Workstreams section: "mt-3 rounded-md border border-gray-200 dark:border-gray-800" */
    workstreams?: SlotValue;
    /** Workstreams header: "p-2 border-b ... bg-gray-50 dark:bg-gray-900/50" */
    workstreamsHeader?: SlotValue;
    /** Individual workstream item: "flex items-center p-1.5 rounded" + dynamic statusBg */
    workstreamItem?: SlotValue;
}

/** Resolved slots. */
export type ResolvedPlanPanelSlots = { [K in keyof PlanPanelSlots]?: string };

/** PlanPanel theme. */
export type PlanPanelTheme = PlanPanelSlots;

// ---------------------------------------------------------------------------
// Top-level conversation theme
// ---------------------------------------------------------------------------

export interface ConversationTheme {
    conversation?: ModernAgentConversationTheme;
    planPanel?: PlanPanelTheme;
    messageItem?: MessageItemTheme;
    streamingMessage?: StreamingMessageTheme;
    toolCallGroup?: ToolCallGroupTheme;
    batchProgressPanel?: BatchProgressPanelTheme;
    allMessagesMixed?: AllMessagesMixedTheme;
    workstreamTabs?: WorkstreamTabsTheme;
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
