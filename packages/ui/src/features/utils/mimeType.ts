const CSV_PREFIX = 'text/csv'
const IMAGE_PREFIX = 'image/'
const PDF_PREFIX = 'application/pdf'
const VIDEO_PREFIX = 'video/'

export const isCsv = (type: string) => type === CSV_PREFIX || CSV_PREFIX.includes(type)
export const isImage = (type: string) => type.startsWith(IMAGE_PREFIX) || IMAGE_PREFIX.includes(type)
export const isPdf = (type: string) => type === PDF_PREFIX || PDF_PREFIX.includes(type)
export const isVideo = (type: string) => type.startsWith(VIDEO_PREFIX) || VIDEO_PREFIX.includes(type)