import { useState, useRef } from "react";
import { UploadIcon } from "lucide-react";
import { Button } from "@vertesia/ui/core";

/**
 * Props for the DropZone component
 */
export interface DropZoneProps {
    /**
     * Callback when files are dropped or selected
     */
    onDrop: (files: File[], customMessage?: { count: number; message: string }) => void;

    /**
     * Message to display in the drop zone
     */
    message: string;

    /**
     * Label for the upload button
     */
    buttonLabel?: string;

    /**
     * Allow selection of folders
     * @default true
     */
    allowFolders?: boolean;

    /**
     * CSS class to apply to the container
     */
    className?: string;
}

/**
 * A reusable drop zone component for file uploads
 *
 * @example
 * <DropZone
 *   onDrop={handleFileSelect}
 *   message="Drag and drop files here"
 *   buttonLabel="Select Files"
 * />
 */
export function DropZone({
    onDrop,
    message,
    buttonLabel = "Upload Files",
    allowFolders = true,
    className = ""
}: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();

        // Only set dragging to false if leaving the container (not entering a child)
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            // Handle folders using the DataTransferItemList API which supports directory reading
            const items = Array.from(e.dataTransfer.items);
            const files: File[] = [];
            const folders = new Set<string>();

            const processEntry = async (entry: any) => {
                if (entry.isFile) {
                    // Get file
                    const file = await new Promise<File>((resolve) => {
                        entry.file((file: File) => {
                            // Store full path in the file object for location use
                            Object.defineProperty(file, "webkitRelativePath", {
                                writable: true,
                                value: entry.fullPath.substring(1), // Remove leading slash
                            });
                            resolve(file);
                        });
                    });

                    // Skip hidden files
                    if (!file.name.startsWith(".") && file.size > 0) {
                        files.push(file);
                    }

                    // Add folder path to tracking
                    const folderPath = entry.fullPath.substring(1).split("/").slice(0, -1).join("/");
                    if (folderPath) {
                        folders.add(folderPath);
                    }
                } else if (entry.isDirectory) {
                    // Get folder reader
                    const reader = entry.createReader();
                    const entries = await new Promise<any[]>((resolve) => {
                        reader.readEntries((entries: any[]) => {
                            resolve(entries);
                        });
                    });

                    // Process all entries
                    await Promise.all(entries.map(processEntry));

                    // Add this folder to tracking
                    const folderPath = entry.fullPath.substring(1);
                    if (folderPath) {
                        folders.add(folderPath);
                    }
                }
            };

            try {
                // Process all dropped items
                await Promise.all(
                    items.map((item) => {
                        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : item;
                        if (entry) {
                            return processEntry(entry);
                        }
                        return Promise.resolve();
                    }),
                );

                if (files.length > 0) {
                    const topLevelFolders = new Set(
                        Array.from(folders)
                            .map((path) => path.split("/")[0])
                            .filter(Boolean),
                    );

                    const folderCount = topLevelFolders.size;
                    const fileCount = files.length;

                    let message = "";
                    if (folderCount > 0) {
                        message =
                            folderCount === 1
                                ? `Preparing to upload 1 folder with ${fileCount} files...`
                                : `Preparing to upload ${folderCount} folders with ${fileCount} files...`;
                    } else {
                        message = `Preparing to upload ${fileCount} file${fileCount === 1 ? "" : "s"}...`;
                    }

                    onDrop(files, { count: files.length, message });
                }
            } catch (error) {
                console.error("Error processing dropped files:", error);
                // Fallback to simple file array if folder processing fails
                const fileArray = Array.from(e.dataTransfer.files);
                if (fileArray.length > 0) {
                    onDrop(fileArray);
                }
            }
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Fallback for browsers that don't support items API
            const fileArray = Array.from(e.dataTransfer.files);
            onDrop(fileArray);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const fileArray = Array.from(e.target.files);

            // Check if there are directories (with webkitRelativePath)
            const hasDirectories = fileArray.some(
                (file) => (file as any).webkitRelativePath && (file as any).webkitRelativePath.includes("/"),
            );

            if (hasDirectories) {
                // Count the unique top-level directories
                const topLevelDirs = new Set(
                    fileArray.map((file) => (file as any).webkitRelativePath?.split("/")[0]).filter(Boolean),
                );

                const folderCount = topLevelDirs.size;
                const fileCount = fileArray.length;

                // Create custom message with folder info
                const formattedMessage =
                    folderCount === 1
                        ? `Preparing to upload 1 folder with ${fileCount} files...`
                        : `Preparing to upload ${folderCount} folders with ${fileCount} files...`;

                const customMessage = {
                    count: fileArray.length,
                    message: formattedMessage,
                };

                onDrop(fileArray, customMessage);
            } else {
                // Regular file upload
                const feedback = {
                    count: fileArray.length,
                    message: `Preparing to upload ${fileArray.length} file${fileArray.length === 1 ? "" : "s"}...`,
                };
                onDrop(fileArray, feedback);
            }
        }
    };

    const openFileSelector = () => {
        if (inputRef.current) {
            inputRef.current.click();
        }
    };

    return (
        <div
            className={`flex flex-col items-center justify-center py-12 border-2 rounded-lg transition-colors ${isDragging ? "border-color-primary bg-color-primary/10" : "border-dashed border-color-border"
                } ${className}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <UploadIcon
                className={`h-12 w-12 mb-3 transition-colors ${isDragging ? "text-primary" : "text-muted/50"}`}
            />
            <p className="text-color-muted-foreground">{message}</p>

            <div className="mt-4 text-center">
                <div className="text-sm text-muted mb-2">Drag and drop files{allowFolders ? " or folders" : ""} here, or</div>
                <Button onClick={openFileSelector}>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    {buttonLabel}
                </Button>

                {/* Hidden file input that accepts both files and folders */}
                <input
                    type="file"
                    ref={inputRef}
                    onChange={handleChange}
                    multiple
                    // @ts-expect-error: webkitdirectory is a non-standard attribute
                    webkitdirectory={allowFolders ? "" : undefined}
                    directory={allowFolders ? "" : undefined}
                    className="hidden"
                />
            </div>
        </div>
    );
}