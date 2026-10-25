import { convertWithTool } from './convert-with-tool.js';

/**
 * Convert a document to markdown with markitdown.
 *
 * @param ext the document's extension (e.g. `docx`); markitdown picks its converter from it
 */
export function markdownWithMarkitdown(buffer: Buffer, ext?: string): Promise<string> {
    return convertWithTool('markitdown', buffer, ext, 'md', (inputFile, outputFile) => [inputFile, '-o', outputFile]);
}
