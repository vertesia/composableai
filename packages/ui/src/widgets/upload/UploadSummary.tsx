import { CheckCircleIcon, AlertCircleIcon, XCircleIcon } from "lucide-react";
import { UploadResultCategory } from "./UploadResultCategory";

/**
 * Processed file information
 */
export interface ProcessedFile {
    /** The name of the file */
    name: string;
    /** The status of the file upload */
    status: 'success' | 'updated' | 'skipped' | 'failed';
    /** Error message if status is 'failed' */
    error?: string;
}

/**
 * Props for the UploadSummary component
 */
export interface UploadSummaryProps {
    /** List of processed files */
    files: ProcessedFile[];
    /** Optional class name for styling */
    className?: string;
    /** Optional folder location where files were uploaded */
    location?: string;
    /** Optional collection name where files were uploaded */
    collection?: string;
}

/**
 * Displays a summary of upload results with collapsible categories
 * 
 * @example
 * <UploadSummary 
 *   files={[
 *     { name: "document1.pdf", status: "success" },
 *     { name: "document2.pdf", status: "skipped" }
 *   ]}
 *   location="/reports/2023"
 * />
 */
export function UploadSummary({ files, className = "", location, collection }: UploadSummaryProps) {
    // Group files by status
    const successFiles = files.filter(f => f.status === 'success');
    const updatedFiles = files.filter(f => f.status === 'updated');
    const skippedFiles = files.filter(f => f.status === 'skipped');
    const failedFiles = files.filter(f => f.status === 'failed');
    
    // Calculate counts
    const successCount = successFiles.length;
    const updatedCount = updatedFiles.length;
    const skippedCount = skippedFiles.length;
    const failedCount = failedFiles.length;
    const totalCount = files.length;
    
    return (
        <div className={`flex flex-col py-2 ${className}`}>
            <div className="flex items-center mb-4">
                <div className="size-8 mr-4 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircleIcon className="size-4 text-success" />
                </div>
                <div>
                    <p className="text-muted">
                        {totalCount} file{totalCount !== 1 ? "s" : ""} processed
                        {collection ? ` in collection '${collection}'` : ""}
                        {location ? ` in folder '${location}'` : ""}
                    </p>
                </div>
            </div>
            
            {/* Upload results categories */}
            <div className="space-y-3 mt-2">
                {/* Successful uploads */}
                {successCount > 0 && (
                    <UploadResultCategory 
                        title="Successfully Uploaded"
                        count={successCount}
                        icon={<CheckCircleIcon className="h-4 w-4 text-green-500" />}
                        items={successFiles.map(f => f.name)}
                    />
                )}
                
                {/* Updated files */}
                {updatedCount > 0 && (
                    <UploadResultCategory 
                        title="Successfully Updated"
                        count={updatedCount}
                        icon={<CheckCircleIcon className="h-4 w-4 text-blue-500" />}
                        items={updatedFiles.map(f => f.name)}
                    />
                )}
                
                {/* Skipped files */}
                {skippedCount > 0 && (
                    <UploadResultCategory 
                        title="Skipped (Already Existed)"
                        count={skippedCount}
                        icon={<AlertCircleIcon className="h-4 w-4 text-amber-500" />}
                        items={skippedFiles.map(f => f.name)}
                    />
                )}
                
                {/* Failed uploads */}
                {failedCount > 0 && (
                    <UploadResultCategory 
                        title="Failed to Upload"
                        count={failedCount}
                        icon={<XCircleIcon className="h-4 w-4 text-red-500" />}
                        items={failedFiles.map(f => f.name)}
                    />
                )}
            </div>
        </div>
    );
}