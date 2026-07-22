import { type ContentObjectItem, type ConversationFile, FileProcessingStatus } from '@vertesia/common';
import {
    Button,
    cn,
    Dropdown,
    insertNewlineAtCursor,
    MenuItem,
    Modal,
    ModalBody,
    ModalTitle,
    Spinner,
    Textarea,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Activity, ArrowUpIcon, FileTextIcon, PaperclipIcon, PlusIcon, SquareIcon, UploadIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SelectDocument } from '../../../store/objects/components/SelectDocument';
import { extractFilesFromClipboard } from '../clipboardFiles.js';
import type { WorkstreamInfo } from '../workstreams.js';
import { ActiveWorkstreamsSummary } from './ActiveWorkstreamsSummary';
import { type AttachmentPreviewItem, AttachmentPreviewList } from './AttachmentPreview';

/** Represents an uploaded file attachment */
export interface UploadedFile {
    id: string;
    name: string;
    type?: string;
    size?: number;
    /** Optional preview URL for images */
    previewUrl?: string;
    /** Artifact path where file is stored (e.g., "files/image.png") */
    artifact_path?: string;
}

/** Represents a selected document from search */
export interface SelectedDocument {
    id: string;
    name: string;
}

export interface ContextWindowUsage {
    usedTokens: number;
    checkpointTokens: number;
    usedPercent: number;
    remainingPercent: number;
}

function formatTokenCountInK(tokens: number): string {
    const value = Math.max(0, tokens) / 1000;
    const maximumFractionDigits = value > 0 && value < 10 && !Number.isInteger(value) ? 1 : 0;
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value)}K`;
}

interface MessageInputProps {
    onSend: (message: string) => void;
    onStop?: () => void;
    disabled?: boolean;
    isSending?: boolean;
    isStopping?: boolean;
    isStreaming?: boolean;
    isCompleted?: boolean;
    contextWindowUsage?: ContextWindowUsage;
    onCompactContext?: () => void;
    isCompactingContext?: boolean;
    activeTaskCount?: number;
    activeWorkstreams?: WorkstreamInfo[];
    placeholder?: string;

    // File upload props
    /** Called when files are dropped/pasted/selected */
    onFilesSelected?: (files: File[]) => void;
    /** Currently uploaded files to display */
    uploadedFiles?: UploadedFile[];
    /** Called when user removes an uploaded file */
    onRemoveFile?: (fileId: string) => void;
    /** Called when user removes a workflow-processed file */
    onRemoveProcessingFile?: (fileId: string) => void;
    /** Accepted file types (e.g., ".pdf,.doc,.png") */
    acceptedFileTypes?: string;
    /** Max number of files allowed */
    maxFiles?: number;
    /** Files being processed by the workflow */
    processingFiles?: Map<string, ConversationFile>;
    /** Run ID used to resolve artifact thumbnails for ready uploaded images. */
    artifactRunId?: string;
    /** Whether any files are still uploading or processing */
    hasProcessingFiles?: boolean;

    // Document search props (render prop for custom search UI)
    /** Render custom document search UI - if provided, shows search button */
    renderDocumentSearch?: (props: {
        isOpen: boolean;
        onClose: () => void;
        onSelect: (doc: SelectedDocument) => void;
    }) => React.ReactNode;
    /** Currently selected documents from search */
    selectedDocuments?: SelectedDocument[];
    /** Called when user removes a selected document */
    onRemoveDocument?: (docId: string) => void;

    // Hide the default object linking (for apps that don't use it)
    hideObjectLinking?: boolean;
    // Hide file upload (for apps that don't use it)
    hideFileUpload?: boolean;
    /** Optional toolbar slot for the agent approval mode selector. */
    approvalModeSlot?: React.ReactNode;
    /** Optional toolbar slot (e.g. the MCP action menu) rendered next to the attachment actions. */
    mcpSlot?: React.ReactNode;
    /** Disable the local input drop overlay when a parent view owns drag/drop handling */
    disableDropZone?: boolean;

    // Styling props for Tailwind customization
    /** Additional className for the container */
    className?: string;
    /** Additional className for the input field */
    inputClassName?: string;
}

export default function MessageInput({
    onSend,
    onStop,
    approvalModeSlot,
    mcpSlot,
    disabled = false,
    isSending = false,
    isStopping = false,
    isStreaming = false,
    isCompleted = false,
    contextWindowUsage,
    onCompactContext,
    isCompactingContext = false,
    activeTaskCount = 0,
    activeWorkstreams = [],
    placeholder,
    // File upload props
    onFilesSelected,
    uploadedFiles = [],
    onRemoveFile,
    onRemoveProcessingFile,
    acceptedFileTypes,
    maxFiles = 5,
    processingFiles,
    artifactRunId,
    hasProcessingFiles = false,
    // Document search props
    renderDocumentSearch,
    selectedDocuments = [],
    onRemoveDocument,
    // Object linking
    hideObjectLinking = false,
    // File upload
    hideFileUpload = false,
    disableDropZone = false,
    // Styling props
    className,
    inputClassName,
}: MessageInputProps) {
    const { t } = useUITranslation();
    const resolvedPlaceholder = placeholder ?? t('agent.typeYourMessage');
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [value, setValue] = useState('');
    const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
    const [isDocSearchOpen, setIsDocSearchOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const canUploadFiles = Boolean(onFilesSelected && !hideFileUpload);
    const canDropFiles = canUploadFiles && !disableDropZone;
    const hasAttachmentActions = !hideObjectLinking || canUploadFiles || Boolean(renderDocumentSearch);
    const uploadLimitReached = uploadedFiles.length >= maxFiles;
    const handleRemoveProcessingFile = onRemoveProcessingFile ?? onRemoveFile;
    const runningWorkstreams = useMemo(
        () => activeWorkstreams.filter((ws) => ws.status === 'running' || ws.status === 'canceling'),
        [activeWorkstreams],
    );
    const activeWorkstreamCount = runningWorkstreams.length || activeTaskCount;
    const contextUsageLabel = contextWindowUsage
        ? t('agent.contextUsageCompactLabel', { percent: contextWindowUsage.usedPercent })
        : undefined;
    const contextTokenUsageLabel = contextWindowUsage
        ? t('agent.contextTokenUsage', {
              used: formatTokenCountInK(contextWindowUsage.usedTokens),
              limit: formatTokenCountInK(contextWindowUsage.checkpointTokens),
          })
        : undefined;
    const attachmentItems = useMemo<AttachmentPreviewItem[]>(() => {
        const items: AttachmentPreviewItem[] = [];
        if (!hideFileUpload && processingFiles) {
            for (const file of processingFiles.values()) {
                const previewUrl = (file as ConversationFile & { preview_url?: string }).preview_url;
                const status =
                    file.status === FileProcessingStatus.UPLOADING
                        ? t('agent.uploading')
                        : file.status === FileProcessingStatus.PROCESSING
                          ? t('agent.processing')
                          : file.status === FileProcessingStatus.ERROR
                            ? t('agent.error')
                            : file.status === FileProcessingStatus.READY
                              ? t('agent.ready')
                              : file.status;
                items.push({
                    id: file.id,
                    name: file.name,
                    contentType: file.content_type,
                    artifactPath: file.artifact_path,
                    previewUrl,
                    removable: Boolean(handleRemoveProcessingFile),
                    statusLabel: status,
                    statusTone:
                        file.status === FileProcessingStatus.ERROR
                            ? 'destructive'
                            : file.status === FileProcessingStatus.READY
                              ? 'success'
                              : 'attention',
                });
            }
        }
        if (!hideFileUpload) {
            for (const file of uploadedFiles) {
                items.push({
                    id: file.id,
                    name: file.name,
                    contentType: file.type,
                    artifactPath: file.artifact_path,
                    previewUrl: file.previewUrl,
                    removable: Boolean(onRemoveFile),
                    statusLabel: t('agent.ready'),
                    statusTone: 'success',
                });
            }
        }
        for (const doc of selectedDocuments) {
            items.push({
                id: doc.id,
                name: doc.name,
                href: `/store/objects/${doc.id}`,
                removable: Boolean(onRemoveDocument),
                statusTone: 'info',
            });
        }
        return items;
    }, [
        handleRemoveProcessingFile,
        hideFileUpload,
        onRemoveDocument,
        onRemoveFile,
        processingFiles,
        selectedDocuments,
        t,
        uploadedFiles,
    ]);

    useEffect(() => {
        if (!disabled && isCompleted) ref.current?.focus();
    }, [disabled, isCompleted]);

    // File handling
    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            if (!canUploadFiles || !onFilesSelected) return;

            const fileArray = Array.from(files);
            const remainingSlots = maxFiles - uploadedFiles.length;
            const filesToAdd = fileArray.slice(0, remainingSlots);

            if (filesToAdd.length > 0) {
                onFilesSelected(filesToAdd);
            }
        },
        [canUploadFiles, onFilesSelected, maxFiles, uploadedFiles.length],
    );

    // Drag and drop handlers
    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (canDropFiles) {
                setIsDragOver(true);
            }
        },
        [canDropFiles],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            if (canDropFiles && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        },
        [canDropFiles, handleFiles],
    );

    // Paste handler for files
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            if (!canUploadFiles) return;
            const files = extractFilesFromClipboard(e.clipboardData?.items);
            if (files.length > 0) {
                handleFiles(files);
            }
        },
        [canUploadFiles, handleFiles],
    );

    // File input change handler
    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (canUploadFiles && e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                // Reset input so same file can be selected again
                e.target.value = '';
            }
        },
        [canUploadFiles, handleFiles],
    );

    const openFileDialog = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // // Document search handlers
    // const handleDocumentSelect = useCallback((doc: SelectedDocument) => {
    //     // Insert document reference into message
    //     const markdownLink = `[📄 ${doc.name}](doc:${doc.id})`;
    //     const currentValue = value || '';
    //     const cursorPos = ref.current?.selectionStart || currentValue.length;
    //     const newValue = currentValue.substring(0, cursorPos) + markdownLink + currentValue.substring(cursorPos);
    //     setValue(newValue);
    //     setIsDocSearchOpen(false);
    // }, [value]);

    const handleDocSearchClose = useCallback(() => setIsDocSearchOpen(false), []);
    const handleDocSearchSelect = useCallback((_doc: SelectedDocument) => setIsDocSearchOpen(false), []);

    const handleSend = () => {
        const message = value.trim();
        // Mirror the send button's disabled condition so the keyboard (Enter) path can't
        // dispatch a send that the parent will reject while files are still uploading —
        // otherwise the text would be cleared below and lost. The disabled button + its
        // "wait for files" tooltip already explain why Enter does nothing here.
        if (!message || disabled || isSending || hasProcessingFiles) return;

        onSend(message);
        setValue('');
    };

    const handleStop = () => {
        if (onStop && !isStopping) {
            onStop();
        }
    };

    // Track Escape key presses for double-tap to stop
    const lastEscapeRef = useRef<number>(0);

    const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
            if (!hasModifier) {
                // Plain Enter sends. Enter with no text does nothing (don't stop, don't send).
                e.preventDefault();
                if (value.trim().length > 0) {
                    // If there's a message, send it (this will interrupt + send message via UserInput signal)
                    handleSend();
                }
                return;
            }
            // Shift+Enter inserts \n natively; Cmd/Ctrl/Alt+Enter do not in most browsers.
            if (!e.shiftKey) {
                e.preventDefault();
                insertNewlineAtCursor(e.currentTarget, setValue);
            }
            return;
        }

        // Double Escape to stop the agent
        if (e.key === 'Escape' && isStreaming && onStop) {
            const now = Date.now();
            if (now - lastEscapeRef.current < 500) {
                // Double Escape within 500ms - stop the agent
                handleStop();
                lastEscapeRef.current = 0;
            } else {
                lastEscapeRef.current = now;
            }
        }
    };

    // Auto-resize textarea as content grows
    const adjustTextareaHeight = useCallback(() => {
        const textarea = ref.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, []);

    useEffect(() => {
        void value;
        adjustTextareaHeight();
    }, [value, adjustTextareaHeight]);

    const handleObjectSelect = (object: ContentObjectItem) => {
        // Create a markdown link with the object title and ID
        const objectTitle = object.properties?.title || object.name || 'Object';
        const objectId = object.id;
        const markdownLink = `[${objectTitle}](store:${objectId})`;

        // Insert the link at cursor position or append to end
        const currentValue = value || '';
        const cursorPos = ref.current?.selectionStart || currentValue.length;
        const newValue = currentValue.substring(0, cursorPos) + markdownLink + currentValue.substring(cursorPos);

        // Update the input value
        setValue(newValue);

        // Close the modal
        setIsObjectModalOpen(false);

        // Focus back on the input
        setTimeout(() => {
            if (ref.current) {
                ref.current.focus();
                // Place cursor after the inserted link
                const newCursorPos = cursorPos + markdownLink.length;
                ref.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 100);
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag/drop target only; file selection is also exposed via the upload button.
        <div
            className={cn(
                'px-3 py-3 flex-shrink-0 transition-all fixed lg:sticky bottom-0 start-0 end-0 lg:start-auto lg:end-auto w-full bg-background/95 backdrop-blur z-10',
                isDragOver && canDropFiles && 'bg-info/10 border-info',
                className,
            )}
            onDragOver={canDropFiles ? handleDragOver : undefined}
            onDragLeave={canDropFiles ? handleDragLeave : undefined}
            onDrop={canDropFiles ? handleDrop : undefined}
        >
            {/* Drag overlay */}
            {isDragOver && canDropFiles && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 rounded-lg z-10 pointer-events-none">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                        <UploadIcon className="size-5" />
                        {t('agent.dropFilesToUpload')}
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            {canUploadFiles && (
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptedFileTypes}
                    onChange={handleFileInputChange}
                    className="hidden"
                />
            )}

            <ActiveWorkstreamsSummary activeWorkstreams={activeWorkstreams} />

            {/* Input row */}
            <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-border/70 bg-mixer-muted/15 p-2.5 shadow-lg shadow-black/5">
                {attachmentItems.length > 0 && (
                    <AttachmentPreviewList
                        items={attachmentItems}
                        artifactRunId={artifactRunId}
                        variant="composer"
                        onRemove={(id) => {
                            if (processingFiles?.has(id)) {
                                handleRemoveProcessingFile?.(id);
                            } else if (uploadedFiles.some((file) => file.id === id)) {
                                onRemoveFile?.(id);
                            } else {
                                onRemoveDocument?.(id);
                            }
                        }}
                        className="gap-1.5"
                    />
                )}
                <div className="flex min-w-0 flex-1">
                    <Textarea
                        ref={ref}
                        value={value}
                        onKeyDown={keyDown}
                        onChange={(e) => setValue(e.target.value)}
                        onPaste={handlePaste}
                        disabled={disabled}
                        aria-label={resolvedPlaceholder}
                        placeholder={resolvedPlaceholder}
                        rows={1}
                        style={{ maxHeight: '160px' }}
                        className={cn(
                            'min-h-[44px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0',
                            inputClassName,
                        )}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {hasAttachmentActions && (
                            <Dropdown
                                align="left"
                                trigger={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 rounded-full text-muted hover:bg-muted"
                                        title={t('agent.addAttachment')}
                                    >
                                        <PlusIcon className="size-4" />
                                    </Button>
                                }
                            >
                                {!hideObjectLinking && (
                                    <MenuItem onClick={() => setIsObjectModalOpen(true)} isDisabled={!isCompleted}>
                                        <PaperclipIcon className="size-4" />
                                        {t('agent.linkObject')}
                                    </MenuItem>
                                )}
                                {canUploadFiles && (
                                    <MenuItem onClick={openFileDialog} isDisabled={uploadLimitReached}>
                                        <UploadIcon className="size-4" />
                                        {t('agent.upload')}
                                    </MenuItem>
                                )}
                                {renderDocumentSearch && (
                                    <MenuItem onClick={() => setIsDocSearchOpen(true)}>
                                        <FileTextIcon className="size-4" />
                                        <span>{t('agent.searchDocuments')}</span>
                                        {selectedDocuments.length > 0 && (
                                            <span className="ms-auto inline-flex items-center justify-center rounded-full bg-info/20 px-1.5 py-0.5 text-[10px] font-medium text-info">
                                                {selectedDocuments.length}
                                            </span>
                                        )}
                                    </MenuItem>
                                )}
                            </Dropdown>
                        )}
                        {approvalModeSlot}
                        {mcpSlot}
                        {contextWindowUsage && (
                            <VTooltip
                                asChild
                                placement="top"
                                size="md"
                                className="text-foreground shadow-lg"
                                description={
                                    <span className="block max-w-56 text-start text-sm leading-6">
                                        <span className="block">
                                            {t('agent.contextRemainingUntilCompact', {
                                                percent: contextWindowUsage.remainingPercent,
                                            })}
                                        </span>
                                        {contextTokenUsageLabel && (
                                            <span className="mt-1 block text-foreground/80">
                                                {contextTokenUsageLabel}
                                            </span>
                                        )}
                                    </span>
                                }
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        'size-8 rounded-lg text-info hover:bg-muted hover:text-info disabled:opacity-60',
                                        'focus-visible:ring-2 focus-visible:ring-info/40',
                                    )}
                                    aria-label={contextUsageLabel}
                                    onClick={onCompactContext}
                                    disabled={!onCompactContext || isCompactingContext}
                                >
                                    {isCompactingContext ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <svg
                                            viewBox="0 0 24 24"
                                            className={cn(
                                                'size-8 -rotate-90',
                                                contextWindowUsage.usedPercent >= 90
                                                    ? 'text-destructive'
                                                    : contextWindowUsage.usedPercent >= 70
                                                      ? 'text-attention'
                                                      : 'text-info',
                                            )}
                                            aria-hidden="true"
                                        >
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="9.75"
                                                fill="none"
                                                strokeWidth="4.5"
                                                className="stroke-current text-muted/50"
                                            />
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="9.75"
                                                fill="none"
                                                pathLength={100}
                                                strokeWidth="4.5"
                                                strokeLinecap="round"
                                                strokeDasharray={100}
                                                style={{ strokeDashoffset: 100 - contextWindowUsage.usedPercent }}
                                                className="stroke-current"
                                            />
                                        </svg>
                                    )}
                                </Button>
                            </VTooltip>
                        )}
                        {runningWorkstreams.length === 0 && activeWorkstreamCount > 0 && (
                            <output className="flex min-w-0 flex-wrap items-center gap-1.5" aria-live="polite">
                                <span className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs text-muted">
                                    <Activity className="size-3 text-attention" />
                                    {t('agent.activeWorkstreams', { count: activeWorkstreamCount })}
                                </span>
                            </output>
                        )}
                    </div>
                    {/* Show Stop button only when streaming AND no text entered */}
                    {/* When user types something, show Send button to allow sending a message */}
                    {isStreaming && onStop && !value.trim() ? (
                        <Button
                            onClick={handleStop}
                            disabled={isStopping}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'size-9 rounded-full border border-border/60 bg-foreground text-background shadow-sm',
                                'hover:bg-foreground/90 hover:text-background',
                                'disabled:bg-mixer-muted/25 disabled:text-muted disabled:opacity-100',
                                '[&_svg]:text-destructive disabled:[&_svg]:text-muted',
                            )}
                            title={t('agent.stopTooltip')}
                        >
                            {isStopping ? (
                                <Spinner size="sm" />
                            ) : (
                                <SquareIcon className="size-3 fill-current stroke-current" />
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSend}
                            disabled={disabled || isSending || !value.trim() || hasProcessingFiles}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'size-9 rounded-full border border-border/60 bg-foreground text-background shadow-sm',
                                'hover:bg-foreground/90 hover:text-background',
                                'disabled:bg-mixer-muted/25 disabled:text-muted disabled:opacity-100',
                            )}
                            title={hasProcessingFiles ? t('agent.waitForFiles') : t('agent.sendTooltip')}
                            aria-label={hasProcessingFiles ? t('agent.waitForFiles') : t('agent.send')}
                        >
                            {isSending ? <Spinner size="sm" /> : <ArrowUpIcon className="size-4" />}
                        </Button>
                    )}
                </div>
            </div>

            {/* Object Selection Modal */}
            <Modal isOpen={isObjectModalOpen} onClose={() => setIsObjectModalOpen(false)} className="min-w-[60vw]">
                <ModalTitle>{t('agent.linkObject')}</ModalTitle>
                <ModalBody className="pb-6">
                    <SelectDocument onChange={handleObjectSelect} />
                </ModalBody>
            </Modal>

            {/* Document Search Modal (render prop) */}
            {renderDocumentSearch?.({
                isOpen: isDocSearchOpen,
                onClose: handleDocSearchClose,
                onSelect: handleDocSearchSelect,
            })}
        </div>
    );
}
