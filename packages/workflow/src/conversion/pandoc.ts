import { convertWithTool } from './convert-with-tool.js';

/**
 * Convert a document to markdown with pandoc.
 *
 * @param file the document, or the path of a document file, which keeps a large document out of memory
 * @param fromFormat the pandoc input format of the document (e.g. `html`, `odt`, `rtf`)
 *
 * `--sandbox` keeps the conversion to the document's own contents: pandoc otherwise fetches what a document references.
 */
export function markdownWithPandoc(file: Buffer | string, fromFormat: string): Promise<string> {
    return convertWithTool('pandoc', file, fromFormat, 'md', (inputFile, outputFile) => [
        '--sandbox',
        '-f',
        fromFormat,
        '-t',
        'markdown',
        '-o',
        outputFile,
        inputFile,
    ]);
}
