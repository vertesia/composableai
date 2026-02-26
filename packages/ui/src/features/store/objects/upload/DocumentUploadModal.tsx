import { Collection, ContentObjectTypeItem, DynamicCollection } from "@vertesia/common";
import { Button, MessageBox, Modal, ModalBody, ModalFooter, ModalTitle, SelectBox, Spinner, useToast, VTooltip } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useTypeRegistry } from "../../types/TypeRegistryProvider.js";
import { DropZone, UploadSummary } from '@vertesia/ui/widgets';
import { AlertCircleIcon, CheckCircleIcon, FileIcon, FolderIcon, Info, UploadIcon, XCircleIcon } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { FileUploadAction, FileWithMetadata, useSmartFileUploadProcessing } from "./useSmartFileUploadProcessing";
import { DocumentUploadResult } from "./useUploadHandler";


/**
 * File upload status for tracking individual files during upload
 */
interface FileUploadStatus {
    file: File;
    status: "pending" | "uploading" | "success" | "error";
    progress: number;
    message?: string;
    id?: string;
    // Track whether this was an update, skip, or new creation
    action?: "create" | "update" | "skip";
}

/**
 * Props for the unified UploadModal component
 */
interface DocumentUploadModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback when the modal is closed */
    onClose: () => void;
    /** Optional initial files to upload */
    files?: File[];
    /** Collection ID to upload to */
    collectionId?: string;
    /** Selected folder for uploaded files */
    selectedFolder?: string | null;
    /** Title for the modal */
    title?: string;
    /** Children to render in the modal */
    children?: ReactNode;
    /** Callback when upload is complete */
    onUploadComplete?: (result: DocumentUploadResult) => void;
    /** Hide the file selection step and proceed directly to type selection */
    hideFileSelection?: boolean;
    /** Show only the type selection, used for type change operations */
    showTypeSelectionOnly?: boolean;
    allowFolders?: boolean;
}

/**
 * Unified upload modal that handles the complete upload process:
 * 1. File selection (if no files provided)
 * 2. Smart file processing to detect duplicates
 * 3. Type selection
 * 4. Upload with progress tracking
 * 5. Result display
 */
export function DocumentUploadModal({
    isOpen,
    onClose,
    files: initialFiles,
    collectionId,
    selectedFolder,
    title = "Upload Files",
    children,
    onUploadComplete,
    hideFileSelection = false,
    showTypeSelectionOnly = false,
    allowFolders = true,
}: DocumentUploadModalProps) {
    const { client } = useUserSession();
    const { registry: typeRegistry } = useTypeRegistry();
    const toast = useToast();
    const [files, setFiles] = useState<File[]>([]);
    const [processedFiles, setProcessedFiles] = useState<FileWithMetadata[]>([]);
    const [processingDone, setProcessingDone] = useState(false);
    const [selectedType, setSelectedType] = useState<ContentObjectTypeItem | null>(null);
    const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [modalKey, setModalKey] = useState(Date.now());
    const [collectionData, setCollectionData] = useState<Collection | DynamicCollection | undefined>(undefined);
    const [result, setResult] = useState<DocumentUploadResult | null>(null);
    const [_title, setTitle] = useState(title);
    const [_description, setDescription] = useState("");

    // Fetch collection details if a collectionId is provided
    useEffect(() => {
        if (!collectionId) return;
        client.store.collections.retrieve(collectionId).then(setCollectionData);
    }, [collectionId]);

    // Update title and description based on current state
    useEffect(() => {
        if (isUploading) {
            setTitle("Uploading Files");
            setDescription(`${Math.round(overallProgress)}% complete`);
        } else if (uploadComplete) {
            setTitle("Upload Complete");
            setDescription("");
        } else if (processingDone) {
            setTitle("File Analysis Results");
            setDescription(`${files.length} file${files.length !== 1 ? "s" : ""}`);
        } else if (files.length > 0) {
            setTitle(title);
            setDescription("Checking for duplicates and updates");
        } else {
            setTitle(title);
            setDescription("");
        }
    }, [isUploading, uploadComplete, processingDone, title, overallProgress, files.length]);

    // Helper function to render collection and folder information
    const renderLocationInfo = () => {
        if (!collectionData && !selectedFolder) return null;

        return (
            <MessageBox className="mb-4" status="default" icon={<FolderIcon className="size-5" />}>
                <div className="flex items-center">
                    <span className="font-medium">Upload Location:</span>
                </div>
                <div className="text-sm mt-1">
                    {collectionData && (
                        <div className="flex items-center">
                            <span className="mr-1">Collection:</span>
                            <span className="font-medium">{collectionData.name}</span>
                        </div>
                    )}
                    {selectedFolder && (
                        <div className="flex items-center mt-1">
                            <span className="mr-1">Folder:</span>
                            <span className="font-medium">{selectedFolder}</span>
                        </div>
                    )}
                </div>
            </MessageBox>
        );
    };

    // Statistics for upload processing
    const [processingStats, setProcessingStats] = useState<{
        toCreate: number;
        toUpdate: number;
        toSkip: number;
    }>({ toCreate: 0, toUpdate: 0, toSkip: 0 });

    // Get the smart file processing utility
    const { checkDocumentProcessing } = useSmartFileUploadProcessing();

    // Get available types from the registry
    const types = useMemo(() => {
        return typeRegistry?.types || [];
    }, [typeRegistry?.types]);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // Always reset state first
            setProcessedFiles([]);
            setProcessingDone(false);
            setSelectedType(null);
            setFileStatuses([]);
            setIsUploading(false);
            setUploadComplete(false);
            setOverallProgress(0);
            setProcessingStats({ toCreate: 0, toUpdate: 0, toSkip: 0 });
            setResult(null);
            setTitle(title);
            setDescription("");

            // Set initial files if provided
            if (initialFiles && initialFiles.length > 0) {
                setFiles(initialFiles);
                processFiles(initialFiles);
            } else {
                setFiles([]);
            }

            // Create a new key to ensure the modal is fresh
            setModalKey(Date.now());
        }
    }, [isOpen, initialFiles]);

    // Complete cleanup when modal closes
    const handleClose = () => {
        // Reset all state to initial values to prevent memory leaks
        setFiles([]);
        setProcessedFiles([]);
        setProcessingDone(false);
        setSelectedType(null);
        setFileStatuses([]);
        setIsUploading(false);
        setUploadComplete(false);
        setOverallProgress(0);
        setProcessingStats({ toCreate: 0, toUpdate: 0, toSkip: 0 });
        setResult(null);
        setTitle(title);
        setDescription("");
        setModalKey(Date.now());

        // Call the provided onClose function
        onClose();
    };

    // Handle file drop/selection
    const handleFileSelect = (newFiles: File[]) => {
        if (newFiles && newFiles.length > 0) {
            setFiles(newFiles);
            processFiles(newFiles);
        }
    };

    // Process files to determine create/update/skip status
    const processFiles = async (filesToProcess: File[]) => {
        if (!filesToProcess.length) return;

        try {
            console.log(`Processing ${filesToProcess.length} files to determine required actions...`);

            // Get the document processing results
            const processed = await checkDocumentProcessing(filesToProcess, selectedFolder, collectionId);
            setProcessedFiles(processed);

            // Count files by action
            const toCreate = processed.filter((f) => f.action === FileUploadAction.CREATE).length;
            const toUpdate = processed.filter((f) => f.action === FileUploadAction.UPDATE).length;
            const toSkip = processed.filter((f) => f.action === FileUploadAction.SKIP).length;

            // Update stats for UI feedback
            setProcessingStats({
                toCreate,
                toUpdate,
                toSkip,
            });

            // Show processing results to user
            toast({
                title: "Files analyzed",
                description: `${filesToProcess.length} file(s): ${toCreate} new, ${toUpdate} to update, ${toSkip} to skip`,
                status: "info",
                duration: 4000,
            });

            // Set processing as complete
            setProcessingDone(true);
        } catch (error) {
            console.error("Error processing files:", error);
            toast({
                title: "Error",
                description: "There was an error analyzing the files",
                status: "error",
                duration: 5000,
            });
        }
    };

    // Handle type selection and start the upload
    const handleUpload = async () => {
        if (!processedFiles.length) return;

        const typeId = selectedType?.id || null;

        // Initialize file statuses
        const initialStatuses = processedFiles.map((fileInfo) => ({
            file: fileInfo.file,
            status: "pending" as const,
            progress: 0,
            action:
                fileInfo.action === FileUploadAction.CREATE
                    ? ("create" as const)
                    : fileInfo.action === FileUploadAction.UPDATE
                        ? ("update" as const)
                        : ("skip" as const),
        }));

        setFileStatuses(initialStatuses);
        setIsUploading(true);
        setUploadComplete(false);

        // Process files in batches
        const filesToSkip = processedFiles.filter((f) => f.action === FileUploadAction.SKIP);
        const filesToUpdate = processedFiles.filter((f) => f.action === FileUploadAction.UPDATE);
        const filesToCreate = processedFiles.filter((f) => f.action === FileUploadAction.CREATE);

        const result: DocumentUploadResult = {
            success: true,
            objectIds: [],
            uploadedFiles: [],
            skippedFiles: [],
            failedFiles: [],
        };

        // Process SKIP files
        for (const fileInfo of filesToSkip) {
            if (fileInfo.existingId) {
                result.objectIds.push(fileInfo.existingId);
                result.skippedFiles.push({
                    id: fileInfo.existingId,
                    name: fileInfo.name,
                    type: typeId,
                    status: "skipped",
                    location: fileInfo.location,
                });

                // Update the file status
                setFileStatuses((current) =>
                    current.map((status) =>
                        status.file === fileInfo.file
                            ? { ...status, status: "success", progress: 100, id: fileInfo.existingId }
                            : status,
                    ),
                );
            }
        }

        // Process files in batches of 50
        const BATCH_SIZE = 50;
        const PROGRESS_UPDATE_INTERVAL = 5; // Update progress every 5 files

        // Helper function to process a batch of files
        const processBatch = async (files: FileWithMetadata[], action: "create" | "update") => {
            const batches = [];
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                batches.push(files.slice(i, i + BATCH_SIZE));
            }

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`Processing ${action} batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);

                // Show progress for larger file sets
                if (files.length > BATCH_SIZE) {
                    const processedCount = batchIndex * BATCH_SIZE;
                    toast({
                        title: `Processing files (${action})`,
                        description: `Processed ${processedCount}/${files.length} files...`,
                        status: "info",
                        duration: 2000,
                    });
                }

                // Process the batch with progress tracking
                let filesProcessedInBatch = 0;
                await Promise.all(
                    batch.map(async (fileInfo) => {
                        try {
                            // Update status to uploading
                            setFileStatuses((current) =>
                                current.map((status) =>
                                    status.file === fileInfo.file
                                        ? { ...status, status: "uploading", progress: 20 }
                                        : status,
                                ),
                            );

                            if (action === "update" && fileInfo.existingId) {
                                // Update existing file
                                await client.store.objects.update(
                                    fileInfo.existingId,
                                    {
                                        type: typeId || undefined,
                                        content: fileInfo.file,
                                        location: fileInfo.location,
                                        name: fileInfo.name,
                                    },
                                    {
                                        createRevision: true,
                                        revisionLabel: "upload on " + new Date().toISOString(),
                                    },
                                );

                                // Update status to success
                                setFileStatuses((current) =>
                                    current.map((status) =>
                                        status.file === fileInfo.file
                                            ? { ...status, status: "success", progress: 100, id: fileInfo.existingId }
                                            : status,
                                    ),
                                );

                                // Add to result
                                result.objectIds.push(fileInfo.existingId);
                                result.uploadedFiles.push({
                                    id: fileInfo.existingId,
                                    name: fileInfo.name,
                                    type: typeId,
                                    status: "updated",
                                    location: fileInfo.location,
                                });
                            } else {
                                // Create new file
                                const createResult = await client.store.objects.create(
                                    {
                                        type: typeId || undefined,
                                        content: fileInfo.file,
                                        location:
                                            fileInfo.location || fileInfo.file.webkitRelativePath || fileInfo.name,
                                    },
                                    {
                                        collection_id: collectionId,
                                    },
                                );

                                // Update status to success
                                setFileStatuses((current) =>
                                    current.map((status) =>
                                        status.file === fileInfo.file
                                            ? { ...status, status: "success", progress: 100, id: createResult.id }
                                            : status,
                                    ),
                                );

                                // Add to result
                                result.objectIds.push(createResult.id);
                                result.uploadedFiles.push({
                                    id: createResult.id,
                                    name: fileInfo.name,
                                    type: typeId,
                                    status: "created",
                                    location: fileInfo.location,
                                });
                            }
                        } catch (error: any) {
                            console.error(`Failed to process file ${fileInfo.name}:`, error);

                            // Update status to error
                            setFileStatuses((current) =>
                                current.map((status) =>
                                    status.file === fileInfo.file
                                        ? {
                                            ...status,
                                            status: "error",
                                            progress: 100,
                                            message: error.message || "Unknown error",
                                        }
                                        : status,
                                ),
                            );

                            // Add to failed result
                            result.failedFiles.push({
                                name: fileInfo.name,
                                error: error.message || "Unknown error",
                                status: "failed",
                                location: fileInfo.location,
                                type: typeId,
                            });

                            // Mark the overall success as false if any file fails
                            result.success = false;
                        }
                        
                        // Update progress every PROGRESS_UPDATE_INTERVAL files
                        filesProcessedInBatch++;
                        if (filesProcessedInBatch % PROGRESS_UPDATE_INTERVAL === 0 || filesProcessedInBatch === batch.length) {
                            setFileStatuses((currentStatuses) => {
                                const completedFiles = currentStatuses.filter(
                                    (f) => f.status === "success" || f.status === "error",
                                ).length;
                                const totalFiles = currentStatuses.length;
                                const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
                                setOverallProgress(progress);
                                return currentStatuses;
                            });
                        }
                    }),
                );

            }
        };

        // Process UPDATE files first, then CREATE files
        if (filesToUpdate.length > 0) {
            await processBatch(filesToUpdate, "update");
        }

        if (filesToCreate.length > 0) {
            await processBatch(filesToCreate, "create");
        }

        // Finalize the upload
        // Ensure all files are accounted for before completing
        setFileStatuses((current) => {
            // Check for any pending files that might have been missed
            const missingStatuses = current
                .filter((status) => status.status === "pending")
                .map((status) => ({
                    ...status,
                    status: "error" as const,
                    progress: 100,
                    message: "Upload process interrupted",
                }));

            if (missingStatuses.length > 0) {
                // Add missing files to the failed files list
                missingStatuses.forEach((status) => {
                    result.failedFiles.push({
                        name: status.file.name,
                        error: "Upload process interrupted",
                        status: "failed",
                        type: selectedType?.id || null,
                    });
                });

                // Update the success flag if any files failed
                result.success = false;

                // Return updated statuses
                return current.map((status) =>
                    status.status === "pending"
                        ? {
                            ...status,
                            status: "error" as const,
                            progress: 100,
                            message: "Upload process interrupted",
                        }
                        : status,
                );
            }

            return current;
        });

        setIsUploading(false);
        setUploadComplete(true);

        // Show summary toast
        const createdCount = result.uploadedFiles.filter((f) => f.status === "created").length;
        const updatedCount = result.uploadedFiles.filter((f) => f.status === "updated").length;
        const skippedCount = result.skippedFiles.length;
        const failedCount = result.failedFiles.length;

        let statusMessage = "";
        if (createdCount > 0) statusMessage += `${createdCount} file${createdCount !== 1 ? "s" : ""} uploaded`;
        if (updatedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${updatedCount} file${updatedCount !== 1 ? "s" : ""} updated`;
        }
        if (skippedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${skippedCount} file${skippedCount !== 1 ? "s" : ""} skipped`;
        }
        if (failedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${failedCount} file${failedCount !== 1 ? "s" : ""} failed`;
        }

        toast({
            title: "Upload Complete",
            description: statusMessage,
            status: failedCount > 0 ? "warning" : "success",
            duration: 5000,
        });
        setResult(result);
    };

    const typeSelection = () => {
        return (
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                    Content Type <span className="text-muted font-normal">(Optional)</span>
                    <VTooltip
                        description="Select a content type to apply to the uploaded files. If left empty, Vertesia will automatically detect the type based on file content."
                        placement="top" size="xs"
                    >
                        <Info className="size-3 ml-2" />
                    </VTooltip>
                </label>
                <SelectBox
                    options={types}
                    value={selectedType}
                    optionLabel={(type) => (type ? type.name : "Select a content type")}
                    placeholder="Select a content type or leave empty for automatic detection"
                    onChange={(selected) => setSelectedType(selected === undefined ? null : selected)}
                    filterBy="name"
                    isClearable
                />
                {selectedType ? (
                    <></>
                ) : (
                    <div className="p-2 rounded-md">
                        <div className="flex items-center text-attention">
                            <CheckCircleIcon className="size-4 mr-1" />
                            Automatic Type Detection
                            <VTooltip
                                description="Vertesia will analyze the content and select the most appropriate type. This is recommended for most uploads and ensures optimal processing."
                                placement="top" size="xs"
                            >
                                <Info className="size-3 ml-2" />
                            </VTooltip>
                        </div>
                    </div>
                )}
            </div>
        )
    };

    // Determine what content to show based on the current state
    const renderModalContent = () => {
        // When showing only type selection, skip directly to the type selection UI
        if (showTypeSelectionOnly) {
            return (
                <ModalBody>
                    {children}

                    {/* Collection and folder information if available */}
                    {renderLocationInfo()}

                    {/* Type selection */}
                    {typeSelection()}
                </ModalBody>
            );
        }

        // Step 1: File selection #todo: update styles
        if (files.length === 0 && !hideFileSelection) {
            return (
                <ModalBody className="flex flex-col items-center justify-center p-8">
                    {/* Collection and folder information if available */}
                    {renderLocationInfo()}

                    <DropZone
                        onDrop={handleFileSelect}
                        message="Drag and drop files here or click to select"
                        buttonLabel="Select Files"
                        className="w-full h-64"
                        allowFolders={allowFolders}
                    />
                    {children}
                </ModalBody>
            );
        }

        // Step 2: File processing and type selection
        if (!isUploading && !uploadComplete) {
            return (
                <ModalBody>
                    {!processingDone ? (
                        // File processing in progress
                        <div className="flex flex-col items-center justify-center py-4">
                            <Spinner size="lg" className="mb-4" />
                            <div className="text-lg font-medium">Analyzing files...</div>
                        </div>
                    ) : (
                        // Processing complete, show type selection
                        <>
                            {/* Collection and folder information if available */}
                            {renderLocationInfo()}

                            <div className="mb-4">
                                {/* File statistics */}
                                <div className="p-4 rounded-md mb-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2">
                                                <UploadIcon className="size-5 text-primary" />
                                                <span className="font-medium">New</span>
                                            </div>
                                            <div className="text-2xl font-semibold">{processingStats.toCreate}</div>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2">
                                                <CheckCircleIcon className="size-5 text-success" />
                                                <span className="font-medium">Update</span>
                                            </div>
                                            <div className="text-2xl font-semibold">{processingStats.toUpdate}</div>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-2">
                                                <AlertCircleIcon className="size-5 text-mixer-attention/40" />
                                                <span className="font-medium">Skip</span>
                                            </div>
                                            <div className="text-2xl font-semibold">{processingStats.toSkip}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Type selection */}
                            {typeSelection()}

                            <MessageBox
                                className="mb-4"
                                status="info"
                            >
                                {processingStats.toCreate + processingStats.toUpdate > 0 ? (
                                    <div className="space-y-1">
                                        <p>
                                            {processingStats.toCreate + processingStats.toUpdate} file{processingStats.toCreate + processingStats.toUpdate > 1 ? "s are" : " is"} ready
                                            to process
                                        </p>
                                        <p>
                                            {processingStats.toSkip > 0 &&
                                                `${processingStats.toSkip} file${processingStats.toSkip > 1 ? "s are" : " is"} already in the system and will be skipped.`}
                                        </p>
                                    </div>
                                ) : processingStats.toSkip > 0 ? (
                                    <span>
                                        All {processingStats.toSkip} file(s) already exist in the system and
                                        will be skipped. You can proceed to view the results.
                                    </span>
                                ) : (
                                    <span>No files to process.</span>
                                )}
                            </MessageBox>

                        </>
                    )}
                </ModalBody>
            );
        }

        // Step 3: Upload in progress #todo: update styles
        if (isUploading) {
            return (
                <ModalBody>
                    {/* Collection and folder information if available */}
                    {renderLocationInfo()}

                    <div className="mb-4">
                        {/* Progress bar */}
                        <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${overallProgress}%` }}
                            />
                        </div>
                    </div>

                    {/* File status list */}
                    <div className="max-h-96 overflow-y-auto">
                        {fileStatuses.map((fileStatus, index) => (
                            <div
                                key={`${fileStatus.file.name}-${index}`}
                                className="flex items-center py-2 border-b border-border last:border-b-0"
                            >
                                <div className="mr-3">
                                    {fileStatus.status === "pending" && (
                                        <FileIcon className="size-5 text-muted" />
                                    )}
                                    {fileStatus.status === "uploading" && <Spinner size="sm" />}
                                    {fileStatus.status === "success" && (
                                        <CheckCircleIcon className="size-5 text-success" />
                                    )}
                                    {fileStatus.status === "error" && <XCircleIcon className="size-5 text-destructive" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="truncate font-medium">{fileStatus.file.name}</div>
                                    <div className="text-xs text-muted">
                                        {fileStatus.status === "pending" && "Waiting..."}
                                        {fileStatus.status === "uploading" && "Uploading..."}
                                        {fileStatus.status === "success" &&
                                            (fileStatus.action === "create"
                                                ? "Created"
                                                : fileStatus.action === "update"
                                                    ? "Updated"
                                                    : "Skipped")}
                                        {fileStatus.status === "error" && fileStatus.message}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ModalBody>
            );
        }

        // Step 4: Upload complete, show results
        return (
            <ModalBody>
                <div className="mb-4">
                    {/* Collection and folder information if available */}
                    {renderLocationInfo()}

                    <UploadSummary
                        files={fileStatuses.map((f) => {
                            // Map fileStatus to the expected ProcessedFile format
                            let status: "success" | "updated" | "skipped" | "failed";

                            if (f.status === "success") {
                                if (f.action === "create") {
                                    status = "success";
                                } else if (f.action === "update") {
                                    status = "updated";
                                } else {
                                    status = "skipped";
                                }
                            } else {
                                status = "failed";
                            }

                            return {
                                name: f.file.name,
                                status,
                                error: f.status === "error" ? f.message : undefined,
                            };
                        })}
                        location={selectedFolder || undefined}
                        collection={collectionData?.name}
                    />
                </div>
            </ModalBody>
        );
    };

    const renderModalFooter = () => {
        // Type-selection-only mode
        if (showTypeSelectionOnly) {
            return (
                <ModalFooter>
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            // Create minimal result with the selected type (or null)
                            const result: DocumentUploadResult = {
                                success: true,
                                objectIds: [],
                                uploadedFiles: [
                                    {
                                        name: "type-selection",
                                        type: selectedType?.id || null,
                                        status: "created",
                                    },
                                ],
                                skippedFiles: [],
                                failedFiles: [],
                            };

                            if (onUploadComplete) {
                                onUploadComplete(result);
                            }
                            handleClose();
                        }}
                    >
                        {selectedType ? `Use ${selectedType.name}` : "Use Automatic Type Detection"}
                    </Button>
                </ModalFooter>
            );
        }

        // File selection step - only show cancel
        if (files.length === 0 && !hideFileSelection) {
            return (
                <ModalFooter>
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                </ModalFooter>
            );
        }

        // Processing and type selection step
        if (!isUploading && !uploadComplete) {
            // Allow upload even without a type (Vertesia will choose one)
            const canUpload = processingDone;

            return (
                <ModalFooter>
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        disabled={!canUpload}
                        onClick={handleUpload}
                    >
                        {processingStats.toCreate + processingStats.toUpdate > 0
                            ? "Upload"
                            : "Continue"}
                    </Button>
                </ModalFooter>
            );
        }

        // Upload in progress - can't cancel
        if (isUploading) {
            return (
                <ModalFooter>
                    <Button variant="ghost" disabled>
                        Uploading...
                    </Button>
                </ModalFooter>
            );
        }

        // Upload complete - close or upload more
        return (
            <ModalFooter>
                <Button
                    variant="ghost"
                    onClick={() => {
                        // Reset state and start over
                        setFiles([]);
                        setProcessedFiles([]);
                        setProcessingDone(false);
                        setSelectedType(null);
                        setFileStatuses([]);
                        setIsUploading(false);
                        setUploadComplete(false);
                        setOverallProgress(0);
                        setProcessingStats({ toCreate: 0, toUpdate: 0, toSkip: 0 });
                    }}
                >
                    Upload More
                </Button>
                <Button onClick={() => {
                    if (onUploadComplete && result) {
                        onUploadComplete(result);
                    }
                    handleClose();
                }}>
                    Close
                </Button>
            </ModalFooter>
        );
    };

    return (
        <Modal key={modalKey} isOpen={isOpen} onClose={handleClose} className="mx-auto" disableCloseOnClickOutside>
            <ModalTitle description={_description}>{_title}</ModalTitle>
            {renderModalContent()}
            {renderModalFooter()}
        </Modal>
    );
}
