
export interface DocPart {
    line_number_start: number
    line_number_end: number
    name: string
    type: string
}

export const getContentPart = (content: string, part: DocPart): string => {
    const lines = content.split('\n');
    const text = lines.filter((_l, i) => i >= part.line_number_start && i <= part.line_number_end).join('\n');
    return text;
}

export const getContentParts = (content: string, parts: DocPart[]): string[] => {
    return parts.map(part => getContentPart(content, part));
}