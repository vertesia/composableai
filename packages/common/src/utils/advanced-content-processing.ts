import mime from 'mime';


const ADVANCED_PROCESSING_PREFIX = 'magic-pdf';

export interface AdvancedProcessingObjectFileParams {
    objectId: string;
    fileId: string;
    prefix?: string;
    contentType?: string;
    path?: any;
}

/**
 * 
 * Advanced content processing only
 * generate a file path based on object ID and file role
 * 
 * @returns 
 */
export function getPathForAdvancedProcessingFile({ objectId, prefix, fileId, contentType }: AdvancedProcessingObjectFileParams) {

    const extension = contentType ? `.${mime.getExtension(contentType)}` : '';
    const p = prefix ? `${prefix}/` : '';

    let path = `${ADVANCED_PROCESSING_PREFIX}/${objectId}/${p}${fileId}`;
    if (!path.endsWith(extension)) {
        path += extension;
    }
    
    return path;
}
