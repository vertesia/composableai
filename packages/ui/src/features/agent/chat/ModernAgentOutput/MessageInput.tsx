import { type ContentObjectItem, type ConversationFile, FileProcessingStatus } from '@vertesia/common';
import { Button, cn, insertNewlineAtCursor, Modal, ModalBody, ModalTitle, Spinner, Textarea } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Activity, ArrowUpIcon, FileTextIcon, PaperclipIcon, SquareIcon, UploadIcon, XIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectDocument } from '../../../store/objects/components/SelectDocument';

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

interface MessageInputProps {
    onSend: (message: string) => void;
    onStop?: () => void;
    disabled?: boolean;
    isSending?: boolean;
    isStopping?: boolean;
    isStreaming?: boolean;
    isCompleted?: boolean;
    activeTaskCount?: number;
    placeholder?: string;

    // File upload props
    /** Called when files are dropped/pasted/selected */
    onFilesSelected?: (files: File[]) => void;
    /** Currently uploaded files to display */
    uploadedFiles?: UploadedFile[];
    /** Called when user removes an uploaded file */
    onRemoveFile?: (fileId: string) => void;
    /** Accepted file types (e.g., ".pdf,.doc,.png") */
    acceptedFileTypes?: string;
    /** Max number of files allowed */
    maxFiles?: number;
    /** Files being processed by the workflow */
    processingFiles?: Map<string, ConversationFile>;
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

    // Styling props for Tailwind customization
    /** Additional className for the container */
    className?: string;
    /** Additional className for the input field */
    inputClassName?: string;
}

export default function MessageInput({
    onSend,
    onStop,
    disabled = false,
    isSending = false,
    isStopping = false,
    isStreaming = false,
    isCompleted = false,
    activeTaskCount = 0,
    placeholder,
    // File upload props
    onFilesSelected,
    uploadedFiles = [],
    onRemoveFile,
    acceptedFileTypes,
    maxFiles = 5,
    processingFiles,
    hasProcessingFiles = false,
    // Document search props
    renderDocumentSearch,
    selectedDocuments = [],
    onRemoveDocument,
    // Object linking
    hideObjectLinking = false,
    // File upload
    hideFileUpload = false,
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

    useEffect(() => {
        if (!disabled && isCompleted) ref.current?.focus();
    }, [disabled, isCompleted]);

    // File handling
    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            if (!onFilesSelected) return;

            const fileArray = Array.from(files);
            const remainingSlots = maxFiles - uploadedFiles.length;
            const filesToAdd = fileArray.slice(0, remainingSlots);

            if (filesToAdd.length > 0) {
                onFilesSelected(filesToAdd);
            }
        },
        [onFilesSelected, maxFiles, uploadedFiles.length],
    );

    // Drag and drop handlers
    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (onFilesSelected) {
                setIsDragOver(true);
            }
        },
        [onFilesSelected],
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

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        },
        [handleFiles],
    );

    // Paste handler for files
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            if (!onFilesSelected) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        // If it's an image without a proper name, generate one
                        if (item.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
                            const extension = item.type.split('/')[1] || 'png';
                            const namedFile = new File([file], `pasted-image-${Date.now()}.${extension}`, {
                                type: file.type,
                            });
                            files.push(namedFile);
                        } else {
                            files.push(file);
                        }
                    }
                }
            }

            if (files.length > 0) {
                handleFiles(files);
            }
        },
        [onFilesSelected, handleFiles],
    );

    // File input change handler
    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                // Reset input so same file can be selected again
                e.target.value = '';
            }
        },
        [handleFiles],
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
        if (!message || disabled || isSending) return;

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
                isDragOver && 'bg-info/10 border-info',
                className,
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 rounded-lg z-10 pointer-events-none">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                        <UploadIcon className="size-5" />
                        {t('agent.dropFilesToUpload')}
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            {onFilesSelected && (
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptedFileTypes}
                    onChange={handleFileInputChange}
                    className="hidden"
                />
            )}

            {/* Input row */}
            <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-border/70 bg-mixer-muted/15 p-2.5 shadow-lg shadow-black/5">
                {((!hideFileUpload && (uploadedFiles.length > 0 || (processingFiles && processingFiles.size > 0))) ||
                    selectedDocuments.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {!hideFileUpload &&
                            processingFiles &&
                            Array.from(processingFiles.values()).map((file) => (
                                <div
                                    key={file.id}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                                        file.status === FileProcessingStatus.ERROR
                                            ? 'bg-destructive/10 text-destructive'
                                            : file.status === FileProcessingStatus.READY
                                              ? 'bg-success/10 text-success'
                                              : 'bg-attention/10 text-attention',
                                    )}
                                >
                                    <FileTextIcon
                                        className={cn(
                                            'size-3.5',
                                            (file.status === FileProcessingStatus.UPLOADING ||
                                                file.status === FileProcessingStatus.PROCESSING) &&
                                                'animate-pulse',
                                        )}
                                    />
                                    <span className="max-w-[140px] truncate">{file.name}</span>
                                    <span className="opacity-70">
                                        {file.status === FileProcessingStatus.UPLOADING
                                            ? t('agent.uploading')
                                            : file.status === FileProcessingStatus.PROCESSING
                                              ? t('agent.processing')
                                              : file.status === FileProcessingStatus.ERROR
                                                ? t('agent.error')
                                                : file.status === FileProcessingStatus.READY
                                                  ? t('agent.ready')
                                                  : file.status}
                                    </span>
                                </div>
                            ))}
                        {!hideFileUpload &&
                            uploadedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs text-success"
                                >
                                    <FileTextIcon className="size-3.5" />
                                    <span className="max-w-[140px] truncate">{file.name}</span>
                                    {onRemoveFile && (
                                        <Button
                                            variant="unstyled"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => onRemoveFile(file.id)}
                                            className="ms-1 rounded p-0.5 hover:bg-success/20"
                                        >
                                            <XIcon className="size-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        {selectedDocuments.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex items-center gap-1.5 rounded-md bg-info/10 px-2 py-1 text-xs text-info"
                            >
                                <FileTextIcon className="size-3.5" />
                                <span className="max-w-[140px] truncate">{doc.name}</span>
                                {onRemoveDocument && (
                                    <Button
                                        variant="unstyled"
                                        aria-label={`Remove ${doc.name}`}
                                        onClick={() => onRemoveDocument(doc.id)}
                                        className="ms-1 rounded p-0.5 hover:bg-info/20"
                                    >
                                        <XIcon className="size-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
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
                        placeholder={
                            isStreaming
                                ? `${t('agent.agentWorking')} ${t('agent.enterToSend')}`
                                : onFilesSelected
                                  ? `${t('agent.askAnything')} ${t('agent.enterToSend')}`
                                  : `${resolvedPlaceholder} ${t('agent.enterToSend')}`
                        }
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
                        {!hideObjectLinking && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-full text-muted"
                                disabled={!isCompleted}
                                onClick={() => setIsObjectModalOpen(true)}
                                aria-label={t('agent.linkObject')}
                            >
                                <PaperclipIcon className="size-4" />
                            </Button>
                        )}
                        {onFilesSelected && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={openFileDialog}
                                disabled={disabled || uploadedFiles.length >= maxFiles}
                                className="h-8 rounded-full px-2 text-xs text-muted"
                            >
                                <UploadIcon className="size-3.5 me-1.5" />
                                {t('agent.upload')}
                            </Button>
                        )}
                        {renderDocumentSearch && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsDocSearchOpen(true)}
                                disabled={disabled}
                                className="h-8 rounded-full px-2 text-xs text-muted"
                            >
                                <FileTextIcon className="size-3.5 me-1.5" />
                                {t('agent.searchDocuments')}
                                {selectedDocuments.length > 0 && (
                                    <span className="ms-1.5 inline-flex items-center justify-center rounded-full bg-info/20 px-1.5 py-0.5 text-[10px] font-medium text-info">
                                        {selectedDocuments.length}
                                    </span>
                                )}
                            </Button>
                        )}
                        {activeTaskCount > 0 && (
                            <span className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs text-muted">
                                <Activity className="size-3 text-attention" />
                                {t('agent.activeWorkstreams', { count: activeTaskCount })}
                            </span>
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
                            title={t('agent.stopAgent')}
                            aria-label={t('agent.stopAgent')}
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
                            title={hasProcessingFiles ? t('agent.waitForFiles') : undefined}
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
