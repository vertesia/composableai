import { Button, Spinner, Modal, ModalBody, ModalTitle, VTooltip, cn, Textarea } from "@vertesia/ui/core";
import { Activity, FileTextIcon, HelpCircleIcon, PaperclipIcon, SendIcon, StopCircleIcon, UploadIcon, XIcon } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ConversationFile, FileProcessingStatus } from "@vertesia/common";
import { SelectDocument } from "../../../store";

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
    placeholder = "Type your message...",
    // File upload props
    onFilesSelected,
    uploadedFiles = [],
    onRemoveFile,
    acceptedFileTypes = ".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp",
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
}: MessageInputProps) {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [value, setValue] = useState("");
    const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
    const [isDocSearchOpen, setIsDocSearchOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    useEffect(() => {
        if (!disabled && isCompleted) ref.current?.focus();
    }, [disabled, isCompleted]);

    // File handling
    const handleFiles = useCallback((files: FileList | File[]) => {
        if (!onFilesSelected) return;

        const fileArray = Array.from(files);
        const remainingSlots = maxFiles - uploadedFiles.length;
        const filesToAdd = fileArray.slice(0, remainingSlots);

        if (filesToAdd.length > 0) {
            onFilesSelected(filesToAdd);
        }
    }, [onFilesSelected, maxFiles, uploadedFiles.length]);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onFilesSelected) {
            setIsDragOver(true);
        }
    }, [onFilesSelected]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    // Paste handler for files
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
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
    }, [onFilesSelected, handleFiles]);

    // File input change handler
    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
            // Reset input so same file can be selected again
            e.target.value = '';
        }
    }, [handleFiles]);

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
        setValue("");
    };

    const handleStop = () => {
        if (onStop && !isStopping) {
            onStop();
        }
    };

    // Track Escape key presses for double-tap to stop
    const lastEscapeRef = useRef<number>(0);

    const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const hasMessage = value.trim().length > 0;

            if (hasMessage) {
                // If there's a message, send it (this will interrupt + send message via UserInput signal)
                handleSend();
            }
            // Enter with no text does nothing (don't stop, don't send)
        }

        // Double Escape to stop the agent
        if (e.key === "Escape" && isStreaming && onStop) {
            const now = Date.now();
            if (now - lastEscapeRef.current < 500) {
                // Double Escape within 500ms - stop the agent
                handleStop();
                lastEscapeRef.current = 0;
            } else {
                lastEscapeRef.current = now;
            }
        }
        // Shift+Enter allows newline (default textarea behavior)
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
        adjustTextareaHeight();
    }, [value, adjustTextareaHeight]);

    const handleObjectSelect = (object: any) => {
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
        <div
            className={cn("p-3 border-t border-muted flex-shrink-0 transition-all fixed lg:sticky bottom-0 left-0 right-0 lg:left-auto lg:right-auto w-full bg-background z-10", isDragOver && "bg-blue-50 dark:bg-blue-900/20 border-blue-400", className)}
            style={{ minHeight: "120px" }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 rounded-lg z-10 pointer-events-none">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                        <UploadIcon className="size-5" />
                        Drop files to upload
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

            {/* Uploaded files preview */}
            {!hideFileUpload && (uploadedFiles.length > 0 || (processingFiles && processingFiles.size > 0)) && (
                <div className="flex flex-col gap-2 mb-3">
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Uploaded Files
                            </span>
                            <VTooltip
                                description="Files uploaded to this conversation remain available throughout. The agent can access them anytime."
                                placement="top"
                                size="md"
                            >
                                <HelpCircleIcon className="size-3 text-gray-400 dark:text-gray-500" />
                            </VTooltip>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Processing files (uploading/processing/error) */}
                            {processingFiles && Array.from(processingFiles.values()).map((file) => (
                                <div
                                    key={file.id}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm",
                                        file.status === FileProcessingStatus.ERROR
                                            ? "bg-destructive/10 text-destructive"
                                            : file.status === FileProcessingStatus.READY
                                                ? "bg-success/10 text-success"
                                                : "bg-attention/10 text-attention",
                                    )}
                                >
                                    <FileTextIcon className={cn(
                                        "size-3.5",
                                        (file.status === FileProcessingStatus.UPLOADING || file.status === FileProcessingStatus.PROCESSING) && "animate-pulse",
                                    )} />
                                    <span className="max-w-[120px] truncate">{file.name}</span>
                                    <span className="text-xs opacity-70">
                                        {file.status === FileProcessingStatus.UPLOADING ? 'Uploading...'
                                            : file.status === FileProcessingStatus.PROCESSING ? 'Processing...'
                                            : file.status === FileProcessingStatus.ERROR ? 'Error'
                                            : file.status === FileProcessingStatus.READY ? 'Ready' : file.status}
                                    </span>
                                </div>
                            ))}
                            {/* Uploaded files (with remove button) */}
                            {uploadedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-md text-sm"
                                >
                                    <FileTextIcon className="size-3.5" />
                                    <span className="max-w-[120px] truncate">{file.name}</span>
                                    {onRemoveFile && (
                                        <button
                                            onClick={() => onRemoveFile(file.id)}
                                            className="ml-1 p-0.5 hover:bg-success/20 rounded"
                                        >
                                            <XIcon className="size-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Selected documents section — always visible regardless of hideFileUpload */}
            {selectedDocuments.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            Document Attachments
                        </span>
                        <VTooltip
                            description="Documents from the store attached to this message. The agent can re-fetch them by ID anytime, or re-attach to include content directly."
                            placement="top"
                            size="md"
                        >
                            <HelpCircleIcon className="size-3 text-blue-400 dark:text-blue-500" />
                        </VTooltip>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedDocuments.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md text-sm text-blue-700 dark:text-blue-300"
                            >
                                <FileTextIcon className="size-3.5" />
                                <span className="max-w-[120px] truncate">{doc.name}</span>
                                {onRemoveDocument && (
                                    <button
                                        onClick={() => onRemoveDocument(doc.id)}
                                        className="ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                                    >
                                        <XIcon className="size-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action buttons row */}
            {(onFilesSelected || renderDocumentSearch) && (
                <div className="flex gap-2 mb-2">
                    {onFilesSelected && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openFileDialog}
                            disabled={disabled || uploadedFiles.length >= maxFiles}
                            className="text-xs"
                        >
                            <UploadIcon className="size-3.5 mr-1.5" />
                            Upload
                        </Button>
                    )}
                    {renderDocumentSearch && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDocSearchOpen(true)}
                            disabled={disabled}
                            className="text-xs"
                        >
                            <FileTextIcon className="size-3.5 mr-1.5" />
                            Search Documents
                            {selectedDocuments.length > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-600 text-white">
                                    {selectedDocuments.length}
                                </span>
                            )}
                        </Button>
                    )}
                </div>
            )}

            {/* Input row */}
            <div className="flex items-end space-x-2">
                <div className="flex flex-1 items-end space-x-1">
                    <Textarea
                        ref={ref}
                        value={value}
                        onKeyDown={keyDown}
                        onChange={(e) => setValue(e.target.value)}
                        onPaste={handlePaste}
                        disabled={disabled}
                        placeholder={isStreaming ? "Agent is working... (Esc Esc to stop)" : (onFilesSelected ? "Ask anything... (drop or paste files)" : placeholder)}
                        rows={2}
                        style={{ minHeight: '60px', maxHeight: '200px' }}
                    />
                    {!hideObjectLinking && (
                        <Button
                            variant="ghost"
                            className="rounded-full"
                            disabled={!isCompleted}
                            onClick={() => setIsObjectModalOpen(true)}
                            alt="Link Object"
                        >
                            <PaperclipIcon className="size-4" />
                        </Button>
                    )}
                </div>
                {/* Show Stop button only when streaming AND no text entered */}
                {/* When user types something, show Send button to allow sending a message */}
                {isStreaming && onStop && !value.trim() ? (
                    <Button
                        onClick={handleStop}
                        disabled={isStopping}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white"
                        title="Stop the agent"
                    >
                        {isStopping ? <Spinner size="sm" className="mr-2" /> : <StopCircleIcon className="size-4 mr-2" />} <span>Stop</span>
                    </Button>
                ) : (
                    <Button
                        onClick={handleSend}
                        disabled={disabled || isSending || !value.trim() || hasProcessingFiles}
                        className="px-4 py-2.5"
                        title={hasProcessingFiles ? "Wait for files to finish processing" : undefined}
                    >
                        {isSending ? <Spinner size="sm" className="mr-2" /> : <SendIcon className="size-4 mr-2" />}
                        <span>{hasProcessingFiles ? "Processing..." : "Send"}</span>
                    </Button>
                )}
            </div>

            <div className="text-xs text-muted mt-2 text-center">
                {activeTaskCount > 0 ? (
                    <div className="flex items-center justify-center">
                        <Activity className="h-3 w-3 mr-1 text-attention" />
                        <span>Agent has {activeTaskCount} active workstream{activeTaskCount !== 1 ? 's' : ''} running</span>
                    </div>
                ) : isStreaming
                    ? "Agent is working... Press Esc twice or click Stop to interrupt"
                    : disabled
                        ? "Agent is processing, you can continue once it completes..."
                        : "Enter to send • Shift+Enter for new line"}
            </div>

            {/* Object Selection Modal */}
            <Modal
                isOpen={isObjectModalOpen}
                onClose={() => setIsObjectModalOpen(false)}
                className='min-w-[60vw]'
            >
                <ModalTitle>Link Object</ModalTitle>
                <ModalBody className="pb-6">
                    <SelectDocument onChange={handleObjectSelect} />
                </ModalBody>
            </Modal>

            {/* Document Search Modal (render prop) */}
            {renderDocumentSearch?.({ isOpen: isDocSearchOpen, onClose: handleDocSearchClose, onSelect: handleDocSearchSelect })}
        </div>
    );
}
