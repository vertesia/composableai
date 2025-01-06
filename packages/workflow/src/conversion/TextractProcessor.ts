import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Block } from "@aws-sdk/client-textract";
import {
    GetDocumentAnalysisCommand,
    StartDocumentAnalysisCommand,
    TextractClient
} from "@aws-sdk/client-textract";
import type { AwsCredentialIdentityProvider } from "@smithy/types";
import Papa from 'papaparse';

interface BlocksMap {
    [key: string]: Block;
}

interface ContentBlock {
    type: 'text' | 'table' | 'image';
    content: string;
    confidence?: number;
    // Optional geometry if it's an image
    left?: number;
    top?: number;
    width?: number;
    height?: number;
}

interface PageContent {
    pageNumber: number;
    blocks: ContentBlock[];
}

interface TextractProcessorOptions {
    fileKey: string;
    region: string;
    bucket: string;
    credentials?: AwsCredentialIdentityProvider;
    log?: any;
    detectImages?: boolean;
    /**
     * NEW: If true, includes cell-confidence information in the table CSV
     */
    includeConfidenceInTables?: boolean;
}

export class TextractProcessor {
    private textractClient: TextractClient;
    private s3Client: S3Client;
    private fileKey: string;
    private bucket: string;
    private log: any;
    private detectImages: boolean;
    /**
     * Whether or not to include confidence values in CSV output for tables.
     */
    private includeConfidenceInTables: boolean;

    constructor({
        fileKey,
        region,
        bucket,
        credentials,
        log,
        detectImages = false,
        includeConfidenceInTables = false  // NEW default = false
    }: TextractProcessorOptions) {
        this.fileKey = fileKey;
        this.bucket = bucket;
        this.log = log;
        this.detectImages = detectImages;
        this.includeConfidenceInTables = includeConfidenceInTables;

        this.textractClient = new TextractClient({
            region,
            credentials
        });
        this.s3Client = new S3Client({
            region,
            credentials
        });
    }

    private getText(result: Block, blocksMap: BlocksMap): string {
        let text = '';
        if (result.Relationships) {
            for (const relationship of result.Relationships) {
                if (relationship.Type === 'CHILD') {
                    for (const childId of relationship.Ids || []) {
                        const word = blocksMap[childId];
                        if (word.BlockType === 'WORD') {
                            const wordText = word.Text || '';
                            // Example logic to quote numeric text with commas
                            if (wordText.includes(',') &&
                                wordText.replace(',', '').match(/^\d+$/)) {
                                text += `"${wordText}" `;
                            } else {
                                text += `${wordText} `;
                            }
                        }
                        if (
                            word.BlockType === 'SELECTION_ELEMENT' &&
                            word.SelectionStatus === 'SELECTED'
                        ) {
                            text += 'X ';
                        }
                    }
                }
            }
        }
        return text.trim();
    }

    private isBlockInTable(block: Block, blocksMap: BlocksMap): boolean {
        if (block.BlockType !== 'LINE') {
            return false;
        }
        if (block.Relationships) {
            for (const relationship of block.Relationships) {
                if (relationship.Type === 'CHILD') {
                    for (const childId of relationship.Ids || []) {
                        const wordBlock = blocksMap[childId];
                        if (this.isWordInTableCell(wordBlock, blocksMap)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private isWordInTableCell(wordBlock: Block, blocksMap: BlocksMap): boolean {
        // Check if the wordBlock is a descendant of any TABLE->CELL block
        for (const blockId in blocksMap) {
            const potentialTable = blocksMap[blockId];
            if (potentialTable.BlockType === 'TABLE' && potentialTable.Relationships) {
                for (const relationship of potentialTable.Relationships) {
                    if (relationship.Type === 'CHILD') {
                        for (const cellId of relationship.Ids || []) {
                            const cell = blocksMap[cellId];
                            if (cell.BlockType === 'CELL' && cell.Relationships) {
                                for (const cellRel of cell.Relationships) {
                                    if (
                                        cellRel.Type === 'CHILD' &&
                                        cellRel.Ids?.includes(wordBlock.Id!)
                                    ) {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * NEW: Helper type to store row and column text along with confidence.
     */
    private getRowsColumnsMap(
        tableResult: Block,
        blocksMap: BlocksMap
    ): {
        rows: Array<Array<{ text: string; confidence: number }>>;
    } {
        const rows: Array<Array<{ text: string; confidence: number }>> = [];

        tableResult.Relationships?.forEach(relationship => {
            if (relationship.Type === 'CHILD') {
                relationship.Ids?.forEach(childId => {
                    const cell = blocksMap[childId];
                    if (cell.BlockType === 'CELL') {
                        const rowIndex = cell.RowIndex || 1;
                        const colIndex = cell.ColumnIndex || 1;

                        // Expand the array if needed
                        if (!rows[rowIndex - 1]) {
                            rows[rowIndex - 1] = [];
                        }

                        // Prepare cell text and confidence
                        const text = this.getText(cell, blocksMap);
                        const confidence = cell.Confidence || 0;

                        // If there's a gap, fill it with placeholders
                        // so that we can safely place text at colIndex - 1
                        for (let i = rows[rowIndex - 1].length; i < colIndex - 1; i++) {
                            rows[rowIndex - 1].push({ text: '', confidence: 0 });
                        }
                        rows[rowIndex - 1][colIndex - 1] = { text, confidence };
                    }
                });
            }
        });

        return { rows };
    }

    private generateTableCSV(
        tableResult: Block,
        blocksMap: BlocksMap,
        _tableIndex: number,
        _pageNumber: number
    ): { csv: string; tableConfidence: number } {
        const { rows } = this.getRowsColumnsMap(tableResult, blocksMap);

        let totalConfidence = 0;
        let cellCount = 0;

        // Prepare CSV data
        const csvData: string[][] = [];
        for (const row of rows) {
            const rowData: string[] = [];
            for (const cell of row) {
                // Add to CSV
                rowData.push(cell.text.trim());
                // Accumulate confidence
                totalConfidence += cell.confidence;
                cellCount++;
            }
            csvData.push(rowData);
        }

        // Compute average confidence (or any other method you prefer)
        const tableConfidence = cellCount > 0 ? (totalConfidence / cellCount) : 0;

        // Convert to CSV
        const csv = Papa.unparse(csvData, {
            delimiter: ',',
            quotes: true,
            quoteChar: '"',
            escapeChar: '"',
            header: false,
            newline: '\n',
            skipEmptyLines: false
        });

        return { csv, tableConfidence };
    }

    async upload(fileBuf: Buffer): Promise<void> {
        this.log.info('Uploading file to S3', { fileKey: this.fileKey });
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.fileKey,
            Body: fileBuf,
        });
        await this.s3Client.send(command);
    }

    async startAnalysis(s3Key: string): Promise<string> {
        const command = new StartDocumentAnalysisCommand({
            DocumentLocation: {
                S3Object: {
                    Bucket: this.bucket,
                    Name: s3Key
                }
            },
            FeatureTypes: ["TABLES"]
        });
        const response = await this.textractClient.send(command);
        return response.JobId!;
    }

    async checkJobStatus(jobId: string): Promise<string> {
        const command = new GetDocumentAnalysisCommand({ JobId: jobId });
        const response = await this.textractClient.send(command);
        return response.JobStatus!;
    }

    private getImagePlaceholder(block: Block): string {
        const geometry = block.Geometry?.BoundingBox;
        if (!geometry) return '';
        const area = (geometry.Width || 0) * (geometry.Height || 0);
        if (area < 0.05) return ''; // skip small images

        const top = geometry.Top || 0;
        const left = geometry.Left || 0;

        let position = '';
        if (top < 0.3) position += 'TOP_';
        else if (top > 0.7) position += 'BOTTOM_';

        if (left < 0.3) position += 'LEFT';
        else if (left > 0.7) position += 'RIGHT';
        else position += 'CENTER';

        return `[IMAGE_${position}]\n`;
    }

    private getIndentationLevel(block: Block): number {
        const left = block.Geometry?.BoundingBox?.Left || 0;
        if (left < 0.15) return 0;
        if (left < 0.25) return 1;
        return 2;
    }

    private isLikelyHeader(block: Block, prevBlock: Block | null): boolean {
        if (!prevBlock) return true;
        const gap = (block.Geometry?.BoundingBox?.Top || 0) -
            ((prevBlock.Geometry?.BoundingBox?.Top || 0) +
                (prevBlock.Geometry?.BoundingBox?.Height || 0));
        return gap > 0.03;
    }

    private formatTextBlock(block: Block, prevBlock: Block | null): string {
        const text = block.Text || '';
        const indentLevel = this.getIndentationLevel(block);
        const indent = '    '.repeat(indentLevel);

        if (this.isLikelyHeader(block, prevBlock)) {
            return `\n${indent}${text}\n`;
        }
        return `${indent}${text}\n`;
    }

    private shouldMergeLines(prev: Block, current: Block): boolean {
        const prevBottom = (prev.Geometry?.BoundingBox?.Top || 0)
            + (prev.Geometry?.BoundingBox?.Height || 0);
        const currentTop = current.Geometry?.BoundingBox?.Top || 0;
        const gap = currentTop - prevBottom;

        // For example, if gap < 0.02, treat them as contiguous
        if (gap < 0.02) {
            return true;
        }
        return false;
    }

    async processResults(jobId: string): Promise<string> {
        let nextToken: string | undefined;
        let allBlocks: Block[] = [];
    
        do {
            const command = new GetDocumentAnalysisCommand({
                JobId: jobId,
                NextToken: nextToken
            });
            const response = await this.textractClient.send(command);
            allBlocks = allBlocks.concat(response.Blocks || []);
            nextToken = response.NextToken;
        } while (nextToken);
    
        // Create blocks map
        const blocksMap: BlocksMap = {};
        for (const block of allBlocks) {
            blocksMap[block.Id!] = block;
        }
    
        // We'll store each page's content in sequence
        const pageContents: PageContent[] = [];
        let currentPage: PageContent | null = null;
    
        // We'll keep track of a "current text block" that we're building
        let currentTextContent = "";
        let prevLineBlock: Block | null = null;
    
        // Sort by page and vertical position
        allBlocks.sort((a, b) => {
            if (a.Page !== b.Page) return (a.Page || 0) - (b.Page || 0);
            return (a.Geometry?.BoundingBox?.Top || 0) - (b.Geometry?.BoundingBox?.Top || 0);
        });
    
        for (const block of allBlocks) {
            if (block.BlockType === 'PAGE') {
                // If we were building a text block, push it before starting a new page
                if (currentTextContent.trim().length > 0 && currentPage) {
                    currentPage.blocks.push({
                        type: 'text',
                        content: currentTextContent
                    });
                }
                if (currentPage) {
                    pageContents.push(currentPage);
                }
                currentPage = {
                    pageNumber: block.Page || 0,
                    blocks: []
                };
                currentTextContent = "";
                prevLineBlock = null;
            }
            else if (currentPage && block.Page === currentPage.pageNumber) {
                // TABLE handling
                if (block.BlockType === 'TABLE') {
                    // If there's a pending text block, push it first
                    if (currentTextContent.trim().length > 0) {
                        currentPage.blocks.push({
                            type: 'text',
                            content: currentTextContent
                        });
                        currentTextContent = "";
                    }
                    const { csv, tableConfidence } = this.generateTableCSV(
                        block,
                        blocksMap,
                        currentPage.blocks.filter(b => b.type === 'table').length + 1,
                        currentPage.pageNumber
                    );
                    currentPage.blocks.push({
                        type: 'table',
                        content: csv,
                        confidence: tableConfidence
                    });
                    prevLineBlock = null;
                }
                // LINE handling (merge or start new)
                else if (block.BlockType === 'LINE' && !this.isBlockInTable(block, blocksMap)) {
                    if (prevLineBlock && this.shouldMergeLines(prevLineBlock, block)) {
                        // If we consider this line to be part of the same paragraph,
                        // just append the text. We'll call formatTextBlock to get
                        // indentation/header logic, but we won't add a leading newline.
                        const formatted = this.formatTextBlock(block, prevLineBlock);
    
                        // formatTextBlock might include a leading newline if isLikelyHeader = true
                        // so you can strip it out if you want them truly "merged" into one paragraph:
                        const mergedText = formatted.replace(/^\s*\n/, " ");
    
                        currentTextContent += " " + mergedText.trim();
                    } else {
                        // If there's an existing text block, push it
                        if (currentTextContent.trim().length > 0) {
                            currentPage.blocks.push({
                                type: 'text',
                                content: currentTextContent
                            });
                        }
                        // Start a new text block
                        currentTextContent = this.formatTextBlock(block, prevLineBlock).trim();
                    }
                    prevLineBlock = block;
                }
                // IMAGES (if detectImages)
                else if (this.detectImages) {
                    const geometry = block.Geometry?.BoundingBox;
                    if (geometry && geometry.Width && geometry.Height) {
                        const imagePlaceholder = this.getImagePlaceholder(block);
                        if (imagePlaceholder) {
                            // If there's a pending text block, push it first
                            if (currentTextContent.trim().length > 0) {
                                currentPage.blocks.push({
                                    type: 'text',
                                    content: currentTextContent
                                });
                                currentTextContent = "";
                            }
    
                            currentPage.blocks.push({
                                type: 'image',
                                content: imagePlaceholder,
                                left: geometry.Left,
                                top: geometry.Top,
                                width: geometry.Width,
                                height: geometry.Height
                            });
                        }
                    }
                    // No line update to prevLineBlock here
                }
            }
        }
    
        // Handle last page
        if (currentPage) {
            if (currentTextContent.trim().length > 0) {
                currentPage.blocks.push({
                    type: 'text',
                    content: currentTextContent
                });
            }
            pageContents.push(currentPage);
        }
    
        // Build final output
        let fulltext = '';
        let imgNumber = 1;
        let tableNumber = 1;
        for (const page of pageContents) {
            fulltext += `<page number="${page.pageNumber}">\n`;
            for (const block of page.blocks) {
                if (block.type === 'text') {
                    fulltext += `<text>\n${block.content}\n</text>\n\n`;
                } else if (block.type === 'table') {
                    const confidenceAttr = block.confidence !== undefined && this.includeConfidenceInTables
                        ? ` confidence="${block.confidence.toFixed(2)}"`
                        : '';
                    fulltext += `<table number=${tableNumber++} type="csv" ${confidenceAttr}>\n`;
                    fulltext += `${block.content}\n`;
                    fulltext += `</table>\n\n`;
                } else if (block.type === 'image') {
                    // Include geometry if you like
                    const leftAttr = block.left ? ` left="${block.left.toFixed(4)}"` : '';
                    const topAttr = block.top ? ` top="${block.top.toFixed(4)}"` : '';
                    const widthAttr = block.width ? ` width="${block.width.toFixed(4)}"` : '';
                    const heightAttr = block.height ? ` height="${block.height.toFixed(4)}"` : '';
    
                    fulltext += `<image id="${imgNumber++}" ${leftAttr}${topAttr}${widthAttr}${heightAttr}>\n${block.content.trim()}\n</image>\n\n`;
                }
            }
            fulltext += `</page>\n\n`;
        }
    
        return fulltext;
    }
    
}
