import { ContentObjectItem } from "@vertesia/common";
import { Spinner, useToast } from "@vertesia/ui/core";
import { DropZone } from '@vertesia/ui/widgets';
import clsx from "clsx";
import { ChangeEvent, useMemo, useState } from "react";
import { DocumentSelection, useOptionalDocumentSelection } from "./DocumentSelectionProvider";
import { ExtendedColumnLayout, DocumentTableColumn } from "./layout/DocumentTableColumn";
import { DocumentGridView, DocumentTableView } from "./layout/documentLayout";
import { useDocumentSearch } from "./search/DocumentSearchContext";
import { FileWithMetadata, DocumentUploadModal, useSmartFileUploadProcessing } from "./upload";

const defaultLayout: ExtendedColumnLayout[] = [
    { name: "ID", field: "id", type: "objectId?slice=-7" },
    { name: "Name", field: ".", type: "objectName" },
    { name: "Type", field: "type.name", type: "string" },
    { name: "Status", field: "status", type: "string" },
    { name: "Updated At", field: "updated_at", type: "date" },
];

interface DocumentTableProps extends DocumentTableImplProps {
    isGridView?: boolean;
    previewObject?: (objectId: string) => void;
    selectedObject?: ContentObjectItem | null;
    onUpload?: (files: File[], type: string | null, collectionId?: string) => Promise<unknown>; // if defined, accept drag drop to upload
    collectionId?: string; // Important: Add collection ID to ensure uploads go to the right collection
}

export function DocumentTable({ isGridView = false, onUpload, collectionId, ...others }: DocumentTableProps) {
    if (onUpload) {
        return (
            <ObjectTableWithDropZone
                {...others}
                onUpload={onUpload}
                isGridView={isGridView}
                collectionId={collectionId}
            />
        );
    } else {
        return <DocumentTableImpl {...others} isGridView={isGridView} />;
    }
}

interface ObjectTableWithDropZoneProps extends DocumentTableProps {
    isGridView?: boolean;
    onUpload: (files: File[], type: string | null, collectionId?: string) => Promise<unknown>;
    collectionId?: string;
    skipTypeModal?: boolean;
}
function ObjectTableWithDropZone({
    isGridView,
    onUpload,
    collectionId,
    skipTypeModal = false,
    ...others
}: ObjectTableWithDropZoneProps) {
    const [isLoading, setLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [processedFiles, setProcessedFiles] = useState<FileWithMetadata[] | null>(null);
    const [typeSelectionOpen, setTypeSelectionOpen] = useState(false);
    const search = useDocumentSearch();
    const toast = useToast();
    const { checkDocumentProcessing } = useSmartFileUploadProcessing();

    // Handle file uploads when a file is dropped
    const handleFileDrop = async (droppedFiles: File[], feedback?: { count: number; message: string }) => {
        console.log("Files dropped on ObjectTable:", droppedFiles.length, feedback);
        setLoading(true);

        try {
            // Always process files with the smart upload processing if we have a collection ID
            if (collectionId) {
                // Process files to check for duplicates, updates, etc.
                const processed = await checkDocumentProcessing(droppedFiles, null, collectionId);
                setProcessedFiles(processed);

                // Create a user-friendly summary message
                const toCreate = processed.filter((f) => f.action === "create").length;
                const toUpdate = processed.filter((f) => f.action === "update").length;
                const toSkip = processed.filter((f) => f.action === "skip").length;

                toast({
                    title: "Files ready to process",
                    description: `${droppedFiles.length} file(s): ${toCreate} new, ${toUpdate} to update, ${toSkip} to skip`,
                    status: "info",
                    duration: 4000,
                });
            } else {
                // If no collection ID, we can't check for duplicates
                setProcessedFiles(null);
            }
        } catch (error) {
            console.error("Error processing files:", error);
            toast({
                title: "Error processing files",
                description: "There was an error checking for duplicate files",
                status: "error",
                duration: 4000,
            });
            // Continue with plain upload in case of error
            setProcessedFiles(null);
        } finally {
            setLoading(false);
            setFiles(droppedFiles);
            setIsDragging(false);

            if (skipTypeModal) {
                // If skipTypeModal is true, we skip our internal modal and call onUpload directly
                console.log("Skipping type modal and calling onUpload directly", {
                    filesLength: droppedFiles.length,
                    processedFilesLength: processedFiles?.length,
                });

                // Pass processed files as a custom property and collectionId as the third parameter
                const uploadPromise = onUpload(droppedFiles, null, collectionId);

                // Attach the processed files to the promise for parent components to use
                if (uploadPromise && typeof uploadPromise === "object") {
                    (uploadPromise as any).processedFiles = processedFiles;
                }
            } else {
                // Otherwise, open our type selection modal
                console.log("Setting typeSelectionOpen to true", { filesLength: droppedFiles.length });
                setTypeSelectionOpen(true);
            }
        }
    };

    // Handle the type selection and start the upload
    const onDoUpload = (typeId?: string | null | undefined) => {
        const filesToUpload = [...files]; // Make a copy to be safe

        // Reset state variables
        setFiles([]);
        setProcessedFiles(null);
        setTypeSelectionOpen(false);

        // If typeid is undefined we cancel the upload
        if (filesToUpload.length > 0 && typeId !== undefined) {
            setLoading(true);

            console.log("Starting upload with", {
                typeId,
                filesCount: filesToUpload.length,
                hasProcessingResults: !!processedFiles,
                collectionId,
            });

            onUpload(filesToUpload, typeId, collectionId).finally(() => {
                setLoading(false);
                search.search(); // Refresh the search results after upload
            });
        }
    };

    // Handle drag events to show the drop zone
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if leaving the container (not entering a child)
        if (e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
        }
        setIsDragging(false);
    };

    return (
        <div
            className="min-h-[400px] relative"
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);

                // Get the files from the drop event
                if (e.dataTransfer.items) {
                    const files: File[] = [];
                    for (let i = 0; i < e.dataTransfer.items.length; i++) {
                        const item = e.dataTransfer.items[i];
                        if (item.kind === "file") {
                            const file = item.getAsFile();
                            if (file) files.push(file);
                        }
                    }

                    if (files.length > 0) {
                        const feedback = {
                            count: files.length,
                            message: `Preparing to upload ${files.length} file${files.length === 1 ? "" : "s"}...`,
                        };
                        handleFileDrop(files, feedback);
                    }
                }
            }}
        >
            {/* Loading overlay */}
            <div
                className={clsx(
                    "bg-white dark:bg-gray-800 opacity-40 absolute inset-0 z-50 flex justify-center items-center",
                    isLoading ? "block" : "hidden",
                )}
            >
                <Spinner size="xl" />
            </div>

            {/* The actual table */}
            <DocumentTableImpl {...others} isGridView={isGridView} />

            {/* Overlay the table with a drop zone */}
            <div className={clsx("absolute inset-0 pointer-events-none", isDragging ? "z-40" : "-z-10")}>
                <div className="w-full h-full relative">
                    <DropZone
                        onDrop={handleFileDrop}
                        message="Drop files or folders here to upload"
                        className={clsx(
                            "absolute inset-0 bg-white/90 dark:bg-gray-800/90 pointer-events-auto",
                            isDragging ? "flex" : "hidden",
                        )}
                        buttonLabel="Select Files or Folders"
                        allowFolders={true}
                    />
                </div>
            </div>

            {/* New unified UploadModal */}
            <DocumentUploadModal
                isOpen={typeSelectionOpen && files.length > 0}
                onClose={() => {
                    // Reset state variables and close the modal
                    setFiles([]);
                    setProcessedFiles(null);
                    setTypeSelectionOpen(false);
                    onDoUpload(undefined);
                }}
                files={files}
                collectionId={collectionId}
                selectedFolder={null}
                title="Upload Files"
                onUploadComplete={(result) => {
                    // Handle upload completion
                    if (result) {
                        // If there are failures, show them
                        if (result.failedFiles && result.failedFiles.length > 0) {
                            toast({
                                title: "Upload Issues",
                                description: `${result.failedFiles.length} file(s) failed to upload`,
                                status: "warning",
                                duration: 5000,
                            });
                        }

                        // On success, summarize the results
                        if (result.success) {
                            const created = result.uploadedFiles.filter((f) => f.status === "created").length;
                            const updated = result.uploadedFiles.filter((f) => f.status === "updated").length;
                            const skipped = result.skippedFiles.length;

                            if (created > 0 || updated > 0) {
                                toast({
                                    title: "Upload Complete",
                                    description: `${created > 0 ? `${created} created` : ""}${created > 0 && updated > 0 ? ", " : ""}${updated > 0 ? `${updated} updated` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
                                    status: "success",
                                    duration: 5000,
                                });
                            }
                        }

                        // Force search refresh
                        search.search();
                    }

                    // Close modal and reset state without passing result
                    setFiles([]);
                    setProcessedFiles(null);
                    setTypeSelectionOpen(false);

                    // Complete the upload process with type ID if successful
                    if (result && result.success && result.objectIds.length > 0) {
                        // We don't have type information here, so pass null (process completed)
                        onDoUpload(null);
                    } else {
                        // Cancel the upload
                        onDoUpload(undefined);
                    }
                }}
            />
        </div>
    );
}

interface DocumentTableImplProps {
    objects: ContentObjectItem[];
    isLoading: boolean;
    layout?: ExtendedColumnLayout[];
    onRowClick?: (object: ContentObjectItem) => void;
    onSelectionChange?: (selection: DocumentSelection) => void;
    highlightRow?: (item: ContentObjectItem) => boolean;
    rowActions?: (item: ContentObjectItem) => React.ReactNode[];
    previewObject?: (objectId: string) => void;
    selectedObject?: ContentObjectItem | null;
    isGridView?: boolean;
}
function DocumentTableImpl({
    objects,
    layout = defaultLayout,
    isLoading,
    onRowClick,
    onSelectionChange,
    highlightRow,
    previewObject,
    selectedObject,
    isGridView,
}: DocumentTableImplProps) {
    const selection = useOptionalDocumentSelection();

    const _onSelectionChange = (object: ContentObjectItem, ev: ChangeEvent<HTMLInputElement>) => {
        if (selection) {
            const isShift = (ev.nativeEvent as any).shiftKey;
            const checked = ev.target.checked;
            if (!checked) {
                selection.remove(object.id);
            } else {
                selection.add(object);
                if (isShift) {
                    const index = objects.findIndex((obj) => obj.id === object.id);
                    const prev = findPreviousSelected(objects, index, selection);
                    if (prev > -1 && prev < index - 1) {
                        const toSelect: ContentObjectItem[] = [];
                        for (let i = prev + 1; i < index; i++) {
                            toSelect.push(objects[i]);
                        }
                        selection.addAll(toSelect);
                    } else {
                        const next = findNextSelected(objects, index, selection);
                        if (next > -1 && next > index + 1) {
                            const toSelect: ContentObjectItem[] = [];
                            for (let i = index + 1; i < next; i++) {
                                toSelect.push(objects[i]);
                            }
                            selection.addAll(toSelect);
                        }
                    }
                }
            }
            onSelectionChange && onSelectionChange(selection);
        }
    };

    const toggleAll = (ev: ChangeEvent<HTMLInputElement>) => {
        if (selection) {
            const checked = ev.target.checked;
            if (!checked) {
                // remove all
                selection.removeAll();
            } else {
                selection.addAll(objects);
            }
        }
    };

    const columns = useMemo(() => {
        // avoid rendering empty layouts
        const actualLayout = layout.length > 0 ? layout : defaultLayout;
        return actualLayout.map((col) => new DocumentTableColumn(col, previewObject));
    }, [layout, previewObject]);

    return isGridView ? (
        <DocumentGridView
            objects={objects}
            isLoading={isLoading}
            columns={columns}
            onRowClick={onRowClick}
            highlightRow={highlightRow}
            previewObject={previewObject}
            selectedObject={selectedObject}
            selection={selection}
            toggleAll={toggleAll}
            onSelectionChange={_onSelectionChange}
        />
    ) : (
        <DocumentTableView
            objects={objects}
            isLoading={isLoading}
            columns={columns}
            onRowClick={onRowClick}
            highlightRow={highlightRow}
            previewObject={previewObject}
            selectedObject={selectedObject}
            selection={selection}
            toggleAll={toggleAll}
            onSelectionChange={_onSelectionChange}
        />
    );
}

function findPreviousSelected(objects: ContentObjectItem[], index: number, selection: DocumentSelection) {
    for (let i = index - 1; i >= 0; i--) {
        if (selection.isSelected(objects[i].id)) {
            return i;
        }
    }
    return -1;
}

function findNextSelected(objects: ContentObjectItem[], index: number, selection: DocumentSelection) {
    const length = objects.length;
    for (let i = index + 1; i < length; i++) {
        if (selection.isSelected(objects[i].id)) {
            return i;
        }
    }
    return -1;
}
