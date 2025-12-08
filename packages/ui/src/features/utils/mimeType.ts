const CSV_PREFIX = 'text/csv'
const IMAGE_PREFIX = 'image/'
const PDF_PREFIX = 'application/pdf'
const VIDEO_PREFIX = 'video/'

// Office document MIME types that can be converted to PDF for preview
const PREVIEWABLE_AS_PDF_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
]

export const isCsv = (type: string) => type === CSV_PREFIX || CSV_PREFIX.includes(type)
export const isImage = (type: string) => type.startsWith(IMAGE_PREFIX) || IMAGE_PREFIX.includes(type)
export const isPdf = (type: string) => type === PDF_PREFIX || PDF_PREFIX.includes(type)
export const isVideo = (type: string) => type.startsWith(VIDEO_PREFIX) || VIDEO_PREFIX.includes(type)
export const isPreviewableAsPdf = (type: string) => PREVIEWABLE_AS_PDF_TYPES.includes(type)