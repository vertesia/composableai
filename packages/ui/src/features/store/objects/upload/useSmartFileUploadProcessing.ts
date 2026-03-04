import { ComplexSearchPayload, ContentObjectItem, FindPayload } from "@vertesia/common";
import { useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { Md5 } from "ts-md5";

/**
 * Types of actions that can be taken with a file
 */
export enum FileUploadAction {
    CREATE = "create", // New document, not in system
    SKIP = "skip", // Document exists, identical, no action needed
    UPDATE = "update", // Document exists but needs updating
}

/**
 * Interface for file metadata with hash information
 */
export interface FileWithMetadata {
    file: File;
    hash?: string;
    name: string;
    size: number;
    location?: string;
    // Optional existing object ID if found
    existingId?: string;
    // Action to take with this file
    action?: FileUploadAction;
    // Any additional metadata needed
    metadata?: Record<string, any>;
}

/**
 * Calculates the MD5 hash of a file
 * @param file The file to hash
 * @returns Promise with the MD5 hash of the file
 */
async function calculateFileHash(file: File): Promise<string | undefined> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const md5 = new Md5();
        md5.appendByteArray(new Uint8Array(arrayBuffer));
        const hash = md5.end();
        return hash?.toString();
    } catch (error) {
        console.error("Error calculating file hash:", error);
        return undefined;
    }
}

/**
 * Prepares files by calculating their hashes and metadata
 * @param files Array of files to process
 * @param selectedFolder Optional folder location for the files
 * @returns Promise with array of files with their metadata
 */
async function prepareFilesWithMetadata(files: File[], selectedFolder?: string | null): Promise<FileWithMetadata[]> {
    const filesWithMetadata: FileWithMetadata[] = [];

    // Process files in batches to avoid overwhelming the browser
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        // Process this batch in parallel
        const metadataResults = await Promise.all(
            batch.map(async (file) => {
                // Determine the location for this file
                let location = selectedFolder || "/";

                // If file has relative path, use it to determine location
                const hasRelativePath = !!(file as any).webkitRelativePath;
                if (hasRelativePath) {
                    const relativePath = (file as any).webkitRelativePath;
                    const pathParts = relativePath.split("/");

                    if (pathParts.length > 1) {
                        // Extract folder path (everything except the filename)
                        const folderPath = pathParts.slice(0, -1).join("/");

                        // Combine with selected folder if any
                        location = selectedFolder ? `${selectedFolder}/${folderPath}` : folderPath;
                    }
                }

                // Calculate hash for content comparison
                const hash = await calculateFileHash(file);

                return {
                    file,
                    hash,
                    name: file.name,
                    size: file.size,
                    location,
                };
            }),
        );

        filesWithMetadata.push(...metadataResults);
    }

    return filesWithMetadata;
}

/**
 * Hook to check if documents need to be created, updated, or skipped
 * @param collectionId Optional collection ID to check within
 * @returns Object with functions to process documents
 */
export function useSmartFileUploadProcessing() {
    const { client } = useUserSession();
    const toast = useToast();

    /**
     * Check files to determine if they need to be created, updated, or skipped
     * @param files Array of files to check
     * @param selectedFolder Optional folder location
     * @param collectionId limit the check to a collection
     * @returns Promise with information about actions to take for each file
     */
    const prepareFilesForUpload = async (
        files: File[],
        selectedFolder?: string | null,
        limitToCollectionId?: string,
    ): Promise<FileWithMetadata[]> => {
        try {
            // First, prepare all the files with their metadata
            console.log(`Preparing metadata for ${files.length} files...`);
            const filesWithMetadata = await prepareFilesWithMetadata(files, selectedFolder);

            const identifyExistingHash = async () => {
                const hashes = filesWithMetadata.map((file) => file.hash).filter(Boolean);
                if (hashes.length === 0) return;

                const query = {
                    "content.etag": { $in: hashes },
                };

                let res: ContentObjectItem[];

                if (limitToCollectionId) {
                    const payload: ComplexSearchPayload = {
                        query: { match: query },
                        select: "id content.etag"
                    };
                    res = (await client.store.collections.searchMembers(limitToCollectionId, payload)).results;
                } else {
                    const payload: FindPayload = {
                        query,
                        select: "id content.etag"
                    };
                    res = await client.store.objects.find(payload);
                }

                for (const doc of res) {
                    const file = filesWithMetadata.find((f) => f.hash === doc.content?.etag);
                    if (file) {
                        file.existingId = doc.id;
                        file.action = FileUploadAction.SKIP;
                    }
                }
            };

            /**
             * Find what file are present based on location and name
             */
            const identifyExistingIds = async () => {
                const unskippedFiles = filesWithMetadata.filter((file) => file.action !== FileUploadAction.SKIP);
                const allLocations = unskippedFiles.map((file) => file.location);
                const uniqueLocations = Array.from(new Set(allLocations));

                const queries = [];
                for (const location of uniqueLocations) {
                    const namesInLocation = unskippedFiles
                        .filter((file) => file.location === location)
                        .map((file) => file.name);
                    const query: Record<string, any> = {
                        "content.name": { $in: namesInLocation },
                        location: location || "/"
                    };
                    if (limitToCollectionId) {
                        const res = client.store.collections.searchMembers(limitToCollectionId, {
                            query: {
                                match: query,
                            },
                            select: "id content.name location" // Only fetch fields needed for comparison
                        }).then((response) => response.results);
                        queries.push(res);
                    } else {
                        const res = client.store.objects.find({
                            query: query,
                            select: "id content.name location" // Only fetch fields needed for comparison
                        });
                        queries.push(res);
                    }
                }

                const results = (await Promise.all(queries)).flat();
                console.log(`Found ${results.length} document to update`, results);

                //update fileWithMetadata
                for (const doc of results) {
                    const file = filesWithMetadata.find(
                        //name must be the same, and location must match (default is "/")
                        (f) =>
                            f.name === doc.content?.name &&
                            (f.location ? f.location === doc.location : doc.location === "/"),
                    );
                    if (file) {
                        file.existingId = doc.id;
                        file.action = FileUploadAction.UPDATE;
                    }
                }
                console.log(
                    `Reconciled ${filesWithMetadata.filter((f) => f.action === FileUploadAction.UPDATE).length}`,
                );
            };

            await identifyExistingHash();
            await identifyExistingIds();

            //set create flag on remaining files
            filesWithMetadata.forEach((f) => {
                if (!f.action) {
                    f.action = FileUploadAction.CREATE;
                }
            });

            // Log the results
            console.log("Document processing check results:", {
                totalFiles: files.length,
                toCreate: filesWithMetadata.filter((f) => f.action === FileUploadAction.CREATE).length,
                toUpdate: filesWithMetadata.filter((f) => f.action === FileUploadAction.UPDATE).length,
                toSkip: filesWithMetadata.filter((f) => f.action === FileUploadAction.SKIP).length,
            });

            return filesWithMetadata;
        } catch (error: any) {
            toast({
                title: "Error in file upload processing check",
                status: "error",
                description: error.message,
            });
            console.log("Error in file upload processing check", error);
            throw new Error("Error in file upload processing check: " + error.message);
        }
    };

    return {
        checkDocumentProcessing: prepareFilesForUpload,
    };
}
