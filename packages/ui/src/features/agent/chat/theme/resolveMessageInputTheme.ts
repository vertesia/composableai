import { type ClassTree, type ThemeClassValue, buildClassChains, resolveClasses } from "./themeUtils";

// ---------------------------------------------------------------------------
// MessageInput theme classes (40 total)
// ---------------------------------------------------------------------------

/** Class overrides for MessageInput DOM elements. */
export interface MessageInputThemeClasses {
    // -- Root & Drag Overlay --
    /** Root container: "p-3 border-t border-muted flex-shrink-0 ... bg-background z-10" */
    root?: ThemeClassValue;
    /** Drag overlay backdrop: "absolute inset-0 ... bg-blue-100/80 dark:bg-blue-900/40 ..." */
    dragOverlay?: ThemeClassValue;
    /** Drag overlay text+icon wrapper: "text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2" */
    dragOverlayText?: ThemeClassValue;
    /** Drag overlay UploadIcon: "size-5" */
    dragOverlayIcon?: ThemeClassValue;

    // -- Attachments --
    /** Attachments preview area: "flex flex-col gap-2 mb-3" */
    attachments?: ThemeClassValue;

    // -- File section --
    /** File section header wrapper: "flex items-center gap-1 mb-1" */
    fileSectionHeader?: ThemeClassValue;
    /** "Uploaded Files" label: "text-xs font-medium text-gray-500 dark:text-gray-400" */
    fileLabel?: ThemeClassValue;
    /** File section HelpCircleIcon: "size-3 text-gray-400 dark:text-gray-500" */
    fileHelpIcon?: ThemeClassValue;
    /** File section VTooltip content */
    fileTooltip?: ThemeClassValue;
    /** File badges container: "flex flex-wrap gap-2" */
    fileList?: ThemeClassValue;
    /** File badge (processing & uploaded): "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm" + status colors */
    fileBadge?: ThemeClassValue;
    /** FileTextIcon inside file badge: "size-3.5" + conditional "animate-pulse" */
    fileBadgeIcon?: ThemeClassValue;
    /** File name span: "max-w-[120px] truncate" */
    fileBadgeName?: ThemeClassValue;
    /** File status text: "text-xs opacity-70" */
    fileBadgeStatus?: ThemeClassValue;
    /** Remove file button: "ml-1 p-0.5 hover:bg-success/20 rounded" */
    fileRemoveButton?: ThemeClassValue;
    /** XIcon inside remove file button: "size-3" */
    fileRemoveIcon?: ThemeClassValue;

    // -- Document section --
    /** Document section header wrapper: "flex items-center gap-1 mb-1" */
    documentSectionHeader?: ThemeClassValue;
    /** "Document Attachments" label: "text-xs font-medium text-blue-600 dark:text-blue-400" */
    documentLabel?: ThemeClassValue;
    /** Document section HelpCircleIcon: "size-3 text-blue-400 dark:text-blue-500" */
    documentHelpIcon?: ThemeClassValue;
    /** Document section VTooltip content */
    documentTooltip?: ThemeClassValue;
    /** Document badges container: "flex flex-wrap gap-2" */
    documentList?: ThemeClassValue;
    /** Document badge: "flex items-center gap-1.5 px-2 py-1 bg-blue-100 ... text-blue-700 ..." */
    documentBadge?: ThemeClassValue;
    /** FileTextIcon inside document badge: "size-3.5" */
    documentBadgeIcon?: ThemeClassValue;
    /** Document name span: "max-w-[120px] truncate" */
    documentBadgeName?: ThemeClassValue;
    /** Remove document button: "ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded" */
    documentRemoveButton?: ThemeClassValue;
    /** XIcon inside remove document button: "size-3" */
    documentRemoveIcon?: ThemeClassValue;

    // -- Action buttons --
    /** Action buttons row: "flex gap-2 mb-2" */
    actionButtons?: ThemeClassValue;
    /** Upload button: "text-xs" */
    uploadButton?: ThemeClassValue;
    /** UploadIcon inside upload button: "size-3.5 mr-1.5" */
    uploadButtonIcon?: ThemeClassValue;
    /** Search Documents button: "text-xs" */
    searchButton?: ThemeClassValue;
    /** FileTextIcon inside search button: "size-3.5 mr-1.5" */
    searchButtonIcon?: ThemeClassValue;

    // -- Input row --
    /** Input row container: "flex items-end space-x-2" */
    inputRow?: ThemeClassValue;
    /** Textarea wrapper: "flex flex-1 items-end space-x-1" */
    textareaWrapper?: ThemeClassValue;
    /** Textarea element: "flex-1 w-full px-3 py-2.5 text-sm border ... rounded-md resize-none overflow-hidden" */
    textarea?: ThemeClassValue;
    /** Link Object button: "rounded-full" */
    linkButton?: ThemeClassValue;
    /** PaperclipIcon inside link button: "size-4" */
    linkButtonIcon?: ThemeClassValue;
    /** Send button: "px-4 py-2.5" */
    sendButton?: ThemeClassValue;
    /** SendIcon inside send button: "size-4 mr-2" */
    sendButtonIcon?: ThemeClassValue;
    /** Send button text label: bare text wrapped in span */
    sendButtonText?: ThemeClassValue;
    /** Stop button: "px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white" */
    stopButton?: ThemeClassValue;
    /** StopCircleIcon inside stop button: "size-4 mr-2" */
    stopButtonIcon?: ThemeClassValue;
    /** Stop button text label: bare text wrapped in span */
    stopButtonText?: ThemeClassValue;

    // -- Status --
    /** Status text: "text-xs text-muted mt-2 text-center" */
    statusText?: ThemeClassValue;
    /** Activity icon in status: "h-3 w-3 mr-1 text-attention" */
    statusIcon?: ThemeClassValue;
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
            dragOverlayText: {
                dragOverlayIcon: {},
            },
        },
        attachments: {
            fileSectionHeader: {
                fileLabel: {},
                fileHelpIcon: {},
                fileTooltip: {},
            },
            fileList: {
                fileBadge: {
                    fileBadgeIcon: {},
                    fileBadgeName: {},
                    fileBadgeStatus: {},
                    fileRemoveButton: {
                        fileRemoveIcon: {},
                    },
                },
            },
            documentSectionHeader: {
                documentLabel: {},
                documentHelpIcon: {},
                documentTooltip: {},
            },
            documentList: {
                documentBadge: {
                    documentBadgeIcon: {},
                    documentBadgeName: {},
                    documentRemoveButton: {
                        documentRemoveIcon: {},
                    },
                },
            },
        },
        actionButtons: {
            uploadButton: {
                uploadButtonIcon: {},
            },
            searchButton: {
                searchButtonIcon: {},
            },
        },
        inputRow: {
            textareaWrapper: {
                textarea: {},
                linkButton: {
                    linkButtonIcon: {},
                },
            },
            sendButton: {
                sendButtonIcon: {},
                sendButtonText: {},
            },
            stopButton: {
                stopButtonIcon: {},
                stopButtonText: {},
            },
        },
        statusText: {
            statusIcon: {},
        },
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
