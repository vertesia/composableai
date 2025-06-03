import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useDocumentSearch } from "../search/DocumentSearchContext";
import { FileUploadAction, useSmartFileUploadProcessing } from "./useSmartFileUploadProcessing";


/**
 * Hook configuration for useUploadHandler
 */
export interface UploadHandlerOptions {
    /**
     * Callback to be called after upload is done with the created object IDs
     */
    onUploadDone: (objectIds: string[]) => Promise<void>;
}

/**
 * Result of the upload process
 */
export interface DocumentUploadResult {
    /** Whether the upload was successful overall */
    success: boolean;
    /** IDs of all processed objects (both newly uploaded and existing) */
    objectIds: string[];
    /** Newly uploaded files information */
    uploadedFiles: UploadedFileInfo[];
    /** Files that were skipped (already existed) */
    skippedFiles: UploadedFileInfo[];
    /** Files that failed to upload */
    failedFiles: UploadedFileInfo[];
}

/**
 * Information about a successfully uploaded file
 */
interface UploadedFileInfo {
    /** The ID of the uploaded object */
    id?: string;
    /** The name of the file */
    name: string;
    /** The name of the file */
    location?: string;
    /** The status of the upload */
    status: "created" | "updated" | "skipped" | "failed";
    /** The type of the object */
    type: string | null;
    /** Has there been any Error */
    error?: string;
}

/**
 * Hook for handling file uploads to the store
 *
 * @param options Configuration options for the upload handler
 * @returns Upload handler function that takes files and type, and returns upload results
 */
export function useDocumentUploadHandler(options: UploadHandlerOptions | ((objectIds: string[]) => Promise<void>)) {
    // Handle both object and legacy function format for backward compatibility
    const onUploadDone = typeof options === "function" ? options : options.onUploadDone;
    const { client, project: projectRef, store } = useUserSession();
    const search = useDocumentSearch();
    const toast = useToast();
    const { checkDocumentProcessing } = useSmartFileUploadProcessing();

    return async (files: File[], type: string | null, collectionId?: string): Promise<DocumentUploadResult> => {
        // Initialize result object
        const result: DocumentUploadResult = {
            success: false,
            objectIds: [],
            uploadedFiles: [],
            skippedFiles: [],
            failedFiles: [],
        };

        if (!projectRef) {
            toast({
                status: "error",
                title: "No project selected",
                duration: 3000,
            });
            return result;
        }

        if (!files || files.length === 0) {
            toast({
                status: "warning",
                title: "No files selected",
                duration: 3000,
            });
            return result;
        }

        const filesToUpload = Array.from(files).filter((file) => file.size > 0);

        if (filesToUpload.length === 0) {
            toast({
                status: "error",
                title: "No valid files selected",
                description: "Please select files with valid content.",
                duration: 5000,
            });
            return result;
        }

        const skippedFilesInfo: UploadedFileInfo[] = [];
        const uploadedFilesInfo: UploadedFileInfo[] = [];
        const failedFilesInfo: UploadedFileInfo[] = [];

        console.log(`Processing ${filesToUpload.length} files with smart file processing...`);

        // Determine if what need to be updated
        const filesWithMetadata = await checkDocumentProcessing(filesToUpload, null, collectionId);

        // Create statistics for user feedback
        const toCreate = filesWithMetadata.filter((f) => f.action === FileUploadAction.CREATE).length;
        const toUpdate = filesWithMetadata.filter((f) => f.action === FileUploadAction.UPDATE).length;
        const toSkip = filesWithMetadata.filter((f) => f.action === FileUploadAction.SKIP).length;

        // Show user feedback about processed files
        toast({
            title: "Files analyzed",
            description: `${filesToUpload.length} file(s): ${toCreate} new, ${toUpdate} to update, ${toSkip} to skip`,
            status: "info",
            duration: 4000,
        });

        // Process SKIP files - add them to skipped list and result IDs
        for (const fileInfo of filesWithMetadata.filter((f) => f.action === FileUploadAction.SKIP && f.existingId)) {
            skippedFilesInfo.push({
                id: fileInfo.existingId,
                name: fileInfo.name,
                type,
                status: "skipped",
                location: fileInfo.location,
            });
        }

        // Collect files for processing (both CREATE and UPDATE)
        const filesToProcess = filesWithMetadata.filter(
            (f) => (f.action === FileUploadAction.CREATE || f.action === FileUploadAction.UPDATE) && f.file,
        );

        if (filesToProcess.length > 0) {
            console.log(
                `Processing ${filesToProcess.length} files (${filesToProcess.filter((f) => f.action === FileUploadAction.CREATE).length
                } create, ${filesToProcess.filter((f) => f.action === FileUploadAction.UPDATE).length} update)...`,
            );

            // Create batches of 50 files
            const batchSize = 50;
            const processBatches = [];

            for (let i = 0; i < filesToProcess.length; i += batchSize) {
                processBatches.push(filesToProcess.slice(i, i + batchSize));
            }

            // Process each batch
            for (let batchIndex = 0; batchIndex < processBatches.length; batchIndex++) {
                const batch = processBatches[batchIndex];
                const processedCount = batchIndex * batchSize;

                console.log(`Processing batch ${batchIndex + 1}/${processBatches.length} (${batch.length} files)`);

                // Show progress for larger file sets
                if (filesToProcess.length > batchSize) {
                    toast({
                        title: "Processing files",
                        description: `Processed ${processedCount}/${filesToProcess.length} files...`,
                        status: "info",
                        duration: 2000,
                    });
                }

                // Process this batch in parallel
                const processResults = await Promise.all(
                    batch.map(async (fileInfo) => {
                        try {
                            if (fileInfo.action === FileUploadAction.UPDATE && fileInfo.existingId) {
                                // UPDATE - Update the existing object
                                const updateResult = await client.store.objects.update(
                                    fileInfo.existingId,
                                    {
                                        type: type || undefined,
                                        content: fileInfo.file,
                                        location: fileInfo.location,
                                        name: fileInfo.name,
                                    },
                                    {
                                        createRevision: true,
                                        revisionLabel: "upload on " + new Date().toISOString(),
                                    },
                                );

                                // Use a separate data structure for updated files
                                uploadedFilesInfo.push({
                                    id: fileInfo.existingId,
                                    name: fileInfo.name,
                                    type,
                                    status: "updated",
                                    location: fileInfo.location,
                                });

                                // Add to result IDs
                                result.objectIds.push(fileInfo.existingId);

                                return {
                                    success: true,
                                    id: updateResult.id,
                                    name: fileInfo.name,
                                    action: "update",
                                };
                            } else {
                                // CREATE - Create a new object
                                // If collectionId is provided, pass it as an option
                                const options = collectionId ? { collection_id: collectionId } : undefined;
                                const createResult = await store.objects.create(
                                    {
                                        type: type || undefined,
                                        content: fileInfo.file,
                                        location:
                                            fileInfo.location || fileInfo.file.webkitRelativePath || fileInfo.name,
                                    },
                                    options,
                                );

                                // Track successful upload
                                uploadedFilesInfo.push({
                                    id: createResult.id,
                                    name: fileInfo.name,
                                    type,
                                    status: "created",
                                    location: fileInfo.location,
                                });
                            }
                        } catch (error: any) {
                            console.error(`Failed to process file ${fileInfo.name}:`, error);

                            // Track failed upload
                            failedFilesInfo.push({
                                name: fileInfo.name,
                                error: error.message || "Unknown error",
                                status: "failed",
                                location: fileInfo.location,
                                type,
                            });

                            toast({
                                status: "error",
                                title: `Processing failed for ${fileInfo.name}`,
                                description: error.message,
                                duration: 4000,
                            });
                        }
                    }),
                );

                // Log batch results
                const creates = uploadedFilesInfo.filter((f) => f.status === "created");
                const updates = uploadedFilesInfo.filter((f) => f.status === "updated");
                const failures = uploadedFilesInfo.filter((f) => f.status === "failed");

                console.log(`Batch ${batchIndex + 1} results:`, {
                    creates,
                    updates,
                    failures,
                    total: processResults.length,
                });
            }
        }

        const uploadedCount = uploadedFilesInfo.filter((f) => f.status === "created").length;
        const updatedCount = uploadedFilesInfo.filter((f) => f.status === "updated").length;
        const failedCount = uploadedFilesInfo.filter((f) => f.status === "failed").length;
        const skippedCount = uploadedFilesInfo.filter((f) => f.status === "skipped").length;

        // Call the original callback with all object IDs and additional metadata
        if (onUploadDone) {
            // Log the actual upload count for debugging
            console.log("Upload complete:", {
                totalObjectIds: result.objectIds.length,
                uploadedFiles: uploadedCount,
                updatedFiles: updatedCount,
                skippedFiles: skippedCount,
                failedFiles: failedCount,
            });

            // Call the callback with all object IDs
            await onUploadDone(result.objectIds);
        }

        // Create a success message that includes information about all file operations
        let statusMessage = "";

        if (uploadedCount > 0) {
            statusMessage += `${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} uploaded`;
        }

        if (updatedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${updatedCount} file${updatedCount !== 1 ? "s" : ""} updated`;
        }

        if (skippedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${skippedCount} file${skippedCount !== 1 ? "s" : ""} skipped (already existed)`;
        }

        if (failedCount > 0) {
            statusMessage += statusMessage ? ", " : "";
            statusMessage += `${failedCount} file${failedCount !== 1 ? "s" : ""} failed`;
        }

        if (statusMessage) {
            toast({
                status: failedCount > 0 ? "warning" : "success",
                title: statusMessage,
                duration: 4000,
            });
        }

        // Refresh search results
        search.search();
        return result;
    };
}
