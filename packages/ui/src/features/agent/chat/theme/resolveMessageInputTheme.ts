import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// MessageInput theme classes (20 total)
// ---------------------------------------------------------------------------

/** Class overrides for MessageInput DOM elements. */
export interface MessageInputThemeClasses {
    /** Root container: "p-3 border-t border-muted flex-shrink-0 transition-all ... bg-background z-10" */
    root?: ThemeClassValue;
    /** Drag overlay backdrop: "absolute inset-0 ... bg-blue-100/80 dark:bg-blue-900/40 ... pointer-events-none" */
    dragOverlay?: ThemeClassValue;
    /** Drag overlay text+icon: "text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2" */
    dragOverlayText?: ThemeClassValue;
    /** Attachments preview area: "flex flex-col gap-2 mb-3" */
    attachments?: ThemeClassValue;
    /** "Uploaded Files" section label: "text-xs font-medium text-gray-500 dark:text-gray-400" */
    fileLabel?: ThemeClassValue;
    /** File badges container: "flex flex-wrap gap-2" */
    fileList?: ThemeClassValue;
    /** File badge (processing & uploaded): "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm" + status colors */
    fileBadge?: ThemeClassValue;
    /** "Document Attachments" section label: "text-xs font-medium text-blue-600 dark:text-blue-400" */
    documentLabel?: ThemeClassValue;
    /** Document badges container: "flex flex-wrap gap-2" */
    documentList?: ThemeClassValue;
    /** Document badge: "flex items-center gap-1.5 px-2 py-1 bg-blue-100 ... text-blue-700 ..." */
    documentBadge?: ThemeClassValue;
    /** Action buttons row (upload/search): "flex gap-2 mb-2" */
    actionButtons?: ThemeClassValue;
    /** Upload button: "text-xs" */
    uploadButton?: ThemeClassValue;
    /** Search Documents button: "text-xs" */
    searchButton?: ThemeClassValue;
    /** Input row container: "flex items-end space-x-2" */
    inputRow?: ThemeClassValue;
    /** Textarea wrapper: "flex flex-1 items-end space-x-1" */
    textareaWrapper?: ThemeClassValue;
    /** Textarea element: "flex-1 w-full px-3 py-2.5 text-sm border ... rounded-md resize-none overflow-hidden" */
    textarea?: ThemeClassValue;
    /** Link Object button: "rounded-full" */
    linkButton?: ThemeClassValue;
    /** Send button: "px-4 py-2.5" */
    sendButton?: ThemeClassValue;
    /** Stop button: "px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white" */
    stopButton?: ThemeClassValue;
    /** Status text: "text-xs text-muted mt-2 text-center" */
    statusText?: ThemeClassValue;
}

/** Resolved theme classes — always flat strings after cascade resolution. */
export type ResolvedMessageInputThemeClasses = { [K in keyof MessageInputThemeClasses]?: string };

/** MessageInput theme — no byType or byViewMode. */
export type MessageInputTheme = MessageInputThemeClasses;

// ---------------------------------------------------------------------------
// Cascade tree — MessageInput DOM hierarchy
// ---------------------------------------------------------------------------

type ClassKey = keyof MessageInputThemeClasses;

const MESSAGE_INPUT_TREE: ClassTree = {
    root: {
        dragOverlay: {
            dragOverlayText: {},
        },
        attachments: {
            fileLabel: {},
            fileList: {
                fileBadge: {},
            },
            documentLabel: {},
            documentList: {
                documentBadge: {},
            },
        },
        actionButtons: {
            uploadButton: {},
            searchButton: {},
        },
        inputRow: {
            textareaWrapper: {
                textarea: {},
                linkButton: {},
            },
            sendButton: {},
            stopButton: {},
        },
        statusText: {},
    },
};

/** Derived once at module load. */
const CLASS_CHAINS = buildClassChains<ClassKey>(MESSAGE_INPUT_TREE);
const CLASS_KEYS = Object.keys(CLASS_CHAINS) as ClassKey[];

const EMPTY: ResolvedMessageInputThemeClasses = {};

/**
 * Resolve a MessageInputTheme into a flat set of class strings.
 */
export function resolveMessageInputTheme(
    theme: MessageInputTheme | undefined,
): ResolvedMessageInputThemeClasses {
    if (!theme) return EMPTY;
    return resolveClasses<ClassKey>(theme, CLASS_CHAINS, CLASS_KEYS);
}
