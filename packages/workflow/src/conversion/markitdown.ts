import { convertWithTool } from './convert-with-tool.js';

/**
 * Convert a document to markdown with markitdown.
 *
 * @param file the document, or the path of a document file, which keeps a large document out of memory
 * @param ext the document's extension (e.g. `docx`), used for the temporary copy of a document given as a Buffer;
 *   markitdown picks its converter from the extension, so a path must end with it
 */
export function markdownWithMarkitdown(file: Buffer | string, ext?: string): Promise<string> {
    return convertWithTool('markitdown', file, ext, 'md', (inputFile, outputFile) => [inputFile, '-o', outputFile]);
}
