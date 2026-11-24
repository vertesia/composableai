import type { ComplexSearchPayload, FindPayload } from '@vertesia/common';
import { errorMessage, useToast } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback } from 'react';
import { Md5 } from 'ts-md5';
import { matchesStoredContent, sha256Hex } from './contentChecksum';

const t = i18nInstance.getFixedT(null, NAMESPACE);

export interface ExistingHashMatch {
    id: string;
    content?: { etag?: string; sha256?: string };
}

/**
 * Types of actions that can be taken with a file
 */
export enum FileUploadAction {
    CREATE = 'create', // New document, not in system
    SKIP = 'skip', // Document exists, identical, no action needed
    UPDATE = 'update', // Document exists but needs updating
}

/**
 * Interface for file metadata with hash information
 */
export interface FileWithMetadata {
    file: File;
    /** MD5 of the bytes, compared with the etag of objects stored before `content.sha256`. */
    hash?: string;
    /** SHA-256 of the bytes, stored as `content.sha256` and compared with it. */
    sha256?: string;
    name: string;
    size: number;
    location?: string;
    // Optional existing object ID if found
    existingId?: string;
    // Action to take with this file
    action?: FileUploadAction;
    // Any additional metadata needed
    metadata?: Record<string, unknown>;
}

/**
 * Marks every file whose bytes an existing object already holds as skipped, with that object's id: several files of a
 * batch can hold the same bytes as one object. A file whose hash could not be computed is never marked.
 */
export function markExistingByHash(files: FileWithMetadata[], existing: ExistingHashMatch[]): void {
    for (const file of files) {
        if (file.action === FileUploadAction.SKIP) continue;
        const doc = existing.find((d) => matchesStoredContent(file, d.content));
        if (doc) {
            file.existingId = doc.id;
            file.action = FileUploadAction.SKIP;
        }
    }
}

/**
 * Calculates the hashes of a file: its SHA-256, stored with the object, and its MD5, only to recognise objects stored
 * before `content.sha256` by their etag. A hash that cannot be computed is left out.
 */
async function calculateFileHashes(file: File): Promise<{ hash?: string; sha256?: string }> {
    let arrayBuffer: ArrayBuffer;
    try {
        arrayBuffer = await file.arrayBuffer();
    } catch (error) {
        console.error('Error reading file for hashing:', error);
        return {};
    }
    const hashes: { hash?: string; sha256?: string } = {};
    try {
        hashes.sha256 = await sha256Hex(arrayBuffer);
    } catch (error) {
        console.error('Error calculating file SHA-256:', error);
    }
    try {
        const md5 = new Md5();
        md5.appendByteArray(new Uint8Array(arrayBuffer));
        hashes.hash = md5.end()?.toString();
    } catch (error) {
        console.error('Error calculating file MD5:', error);
    }
    return hashes;
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
                let location = selectedFolder || '/';

                // If file has relative path, use it to determine location
                const hasRelativePath = !!file.webkitRelativePath;
                if (hasRelativePath) {
                    const relativePath = file.webkitRelativePath;
                    const pathParts = relativePath.split('/');

                    if (pathParts.length > 1) {
                        // Extract folder path (everything except the filename)
                        const folderPath = pathParts.slice(0, -1).join('/');

                        // Combine with selected folder if any
                        location = selectedFolder ? `${selectedFolder}/${folderPath}` : folderPath;
                    }
                }

                // Calculate hashes for content comparison
                const { hash, sha256 } = await calculateFileHashes(file);

                return {
                    file,
                    hash,
                    sha256,
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
    const prepareFilesForUpload = useCallback(
        async (
            files: File[],
            selectedFolder?: string | null,
            limitToCollectionId?: string,
        ): Promise<FileWithMetadata[]> => {
            try {
                // First, prepare all the files with their metadata
                console.log(`Preparing metadata for ${files.length} files...`);
                const filesWithMetadata = await prepareFilesWithMetadata(files, selectedFolder);

                const identifyExistingHash = async () => {
                    const sha256s = filesWithMetadata.flatMap((file) => (file.sha256 ? [file.sha256] : []));
                    const md5s = filesWithMetadata.flatMap((file) => (file.hash ? [file.hash] : []));
                    // Objects store the SHA-256 of their bytes as `content.sha256`. Older ones have only their etag,
                    // the MD5 of their bytes on most storage.
                    const clauses: Record<string, unknown>[] = [];
                    if (sha256s.length > 0) clauses.push({ 'content.sha256': { $in: sha256s } });
                    if (md5s.length > 0) clauses.push({ 'content.etag': { $in: md5s } });
                    if (clauses.length === 0) return;
                    const query = { $or: clauses };

                    let res: ExistingHashMatch[];

                    if (limitToCollectionId) {
                        const payload: ComplexSearchPayload = {
                            query: { match: query },
                            select: 'id content.etag content.sha256',
                        };
                        res = (
                            await client.store.collections.searchMembers(limitToCollectionId, payload)
                        ).results.filter((doc): doc is ExistingHashMatch => typeof doc.id === 'string');
                    } else {
                        const payload = {
                            query,
                            select: 'id content.etag content.sha256',
                        } satisfies FindPayload & { select: string };
                        res = (await client.store.objects.find(payload)).flatMap((doc) =>
                            typeof doc.id === 'string' ? [{ id: doc.id, content: doc.content }] : [],
                        );
                    }

                    markExistingByHash(filesWithMetadata, res);
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
                        const query: Record<string, unknown> = {
                            'content.name': { $in: namesInLocation },
                            location: location || '/',
                        };
                        if (limitToCollectionId) {
                            const res = client.store.collections
                                .searchMembers(limitToCollectionId, {
                                    query: {
                                        match: query,
                                    },
                                    select: 'id content.name location', // Only fetch fields needed for comparison
                                })
                                .then((response) => response.results);
                            queries.push(res);
                        } else {
                            const res = client.store.objects.find({
                                query: query,
                                select: 'id content.name location', // Only fetch fields needed for comparison
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
                                (f.location ? f.location === doc.location : doc.location === '/'),
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
                console.log('Document processing check results:', {
                    totalFiles: files.length,
                    toCreate: filesWithMetadata.filter((f) => f.action === FileUploadAction.CREATE).length,
                    toUpdate: filesWithMetadata.filter((f) => f.action === FileUploadAction.UPDATE).length,
                    toSkip: filesWithMetadata.filter((f) => f.action === FileUploadAction.SKIP).length,
                });

                return filesWithMetadata;
            } catch (error: unknown) {
                toast({
                    title: t('store.errorInUploadProcessingCheck'),
                    status: 'error',
                    description: errorMessage(error),
                });
                console.log('Error in file upload processing check', error);
                throw new Error(`Error in file upload processing check: ${errorMessage(error)}`, { cause: error });
            }
        },
        [client, toast],
    );

    return {
        checkDocumentProcessing: prepareFilesForUpload,
    };
}
