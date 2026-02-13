import { type AgentMessageType } from "@vertesia/common";

// ---------------------------------------------------------------------------
// MessageItem theme classes (22 slots)
// ---------------------------------------------------------------------------

/** Class overrides for individual MessageItem DOM elements. */
export interface MessageItemThemeClasses {
    /** Root container: "w-full max-w-full" */
    root?: string;
    /** Card wrapper: "border-l-4 bg-white dark:bg-gray-900 mb-4 ..." */
    card?: string;
    /** Header row: "flex items-center justify-between px-4 py-1.5" */
    header?: string;
    /** Header left group: "flex items-center gap-1.5" */
    headerLeft?: string;
    /** Icon wrapper */
    icon?: string;
    /** Sender label: "text-xs font-medium text-muted" */
    sender?: string;
    /** Workstream badge: "text-xs text-muted ml-1" */
    badge?: string;
    /** Header right group: "flex items-center gap-1.5 print:hidden" */
    headerRight?: string;
    /** Timestamp: "text-[11px] text-muted/70" */
    timestamp?: string;
    /** Copy button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    copyButton?: string;
    /** Export button: "text-muted/50 hover:text-muted h-5 w-5 p-0" */
    exportButton?: string;
    /** Content section: "px-4 pb-3 bg-white dark:bg-gray-900 overflow-hidden" */
    content?: string;
    /** Message body wrapper: "message-content break-words w-full" */
    body?: string;
    /** Prose wrapper for markdown: "vprose prose prose-slate ... text-[15px]" */
    prose?: string;
    /** JSON pre block: "text-xs font-mono ..." */
    jsonPre?: string;
    /** Artifacts container: "mt-3 text-xs" */
    artifacts?: string;
    /** Artifacts label: "font-medium text-muted mb-1" */
    artifactsLabel?: string;
    /** Image previews wrapper: "mb-2 flex flex-wrap gap-3" */
    artifactImages?: string;
    /** Artifact download buttons wrapper: "flex flex-wrap gap-2 print:hidden" */
    artifactButtons?: string;
    /** Details section: "mt-2 print:hidden" */
    details?: string;
    /** Details toggle button: "text-xs text-muted flex items-center" */
    detailsToggle?: string;
    /** Details content panel: "mt-2 p-2 bg-muted ..." */
    detailsContent?: string;
}

// ---------------------------------------------------------------------------
// MESSAGE_STYLES override support
// ---------------------------------------------------------------------------

/** Per-message-type visual config (border, bg, icon color, sender label, icon component). */
export interface MessageStyleConfig {
    borderColor: string;
    bgColor: string;
    iconColor: string;
    sender: string;
    Icon: React.ComponentType<{ className?: string }>;
}

// ---------------------------------------------------------------------------
// MessageItem theme
// ---------------------------------------------------------------------------

/** MessageItem theme — flat class overrides + optional message style overrides. */
export interface MessageItemTheme extends MessageItemThemeClasses {
    /** Override per-type visual styles (border color, bg, icon, sender label, icon component). */
    messageStyles?: Partial<Record<AgentMessageType | 'default', Partial<MessageStyleConfig>>>;
}

const EMPTY: MessageItemThemeClasses = {};

export function resolveMessageItemTheme(
    theme: MessageItemTheme | undefined,
): MessageItemThemeClasses {
    return theme ?? EMPTY;
}
