/**
 * File source information for direct file access without object lookup.
 * Used in dual-mode activities that can work with either objects or direct file URLs.
 */
export interface FileSource {
    /** Direct URL to the source file (GCS/S3 path). If provided, skips object lookup. */
    source_url: string;
    /** MIME type of the source file. Required when using source_url. */
    mimetype: string;
    /** Storage path for artifacts. Required when using source_url, otherwise uses objectIds[0]. */
    storage_path: string;
}