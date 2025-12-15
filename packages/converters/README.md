# @vertesia/converters

Image and document conversion utilities for Node.js. Provides functions for image transformation, PDF to text extraction, and document to Markdown conversion.

## Features

- **Image Transformation**: Resize and convert images using Sharp
- **PDF to Text**: Extract text from PDF files using MuTool
- **Document to Markdown**: Convert various document formats to Markdown using Pandoc

## Installation

```bash
npm install @vertesia/converters
# or
pnpm add @vertesia/converters
```

### System Dependencies

Some converters require external tools to be installed:

- **Image conversion**: No external dependencies (uses Sharp)
- **PDF to text**: Requires [MuTool](https://mupdf.com/docs/mutool.html) (`mutool` command)
- **Document to Markdown**: Requires [Pandoc](https://pandoc.org/) (`pandoc` command)

## Usage

### Image Transformation

Transform images with resizing and format conversion:

```typescript
import {
  transformImage,
  transformImageToBuffer,
  transformImageToFile
} from '@vertesia/converters';

// Transform image to a stream
import { createReadStream, createWriteStream } from 'fs';

const input = createReadStream('input.jpg');
const output = createWriteStream('output.webp');

await transformImage(input, output, {
  max_hw: 1024,      // Max width/height (maintains aspect ratio)
  format: 'webp'     // Output format
});

// Transform image to buffer
const buffer = await transformImageToBuffer(inputBuffer, {
  max_hw: 800,
  format: 'png'
});

// Transform image to file
await transformImageToFile(inputBuffer, 'output.jpg', {
  max_hw: 1200,
  format: 'jpeg'
});
```

### PDF to Text

Extract text content from PDF files:

```typescript
import { pdfToText, pdfToTextBuffer, pdfFileToText } from '@vertesia/converters';

// From buffer to string
const text = await pdfToText(pdfBuffer);

// From buffer to buffer
const textBuffer = await pdfToTextBuffer(pdfBuffer);

// From file to file
await pdfFileToText('input.pdf', 'output.txt');
```

### Document to Markdown

Convert documents to Markdown format using Pandoc:

```typescript
import { manyToMarkdown } from '@vertesia/converters';
import { createReadStream } from 'fs';

// Convert DOCX to Markdown
const stream = createReadStream('document.docx');
const markdown = await manyToMarkdown(stream, 'docx');

// Convert HTML to Markdown
const htmlStream = createReadStream('page.html');
const md = await manyToMarkdown(htmlStream, 'html');
```

Supported input formats include all formats supported by Pandoc: `docx`, `html`, `latex`, `rst`, `textile`, `org`, `mediawiki`, and many more.

## API Reference

### Image Functions

| Function | Description |
|----------|-------------|
| `transformImage(input, output, opts)` | Transform image from stream to stream |
| `transformImageToBuffer(input, opts)` | Transform image to buffer |
| `transformImageToFile(input, output, opts)` | Transform image to file |

#### TransformOptions

| Option | Type | Description |
|--------|------|-------------|
| `max_hw` | `number` | Maximum width/height (maintains aspect ratio, no upscaling) |
| `format` | `string` | Output format (`jpeg`, `png`, `webp`, `avif`, etc.) |

### PDF Functions

| Function | Description |
|----------|-------------|
| `pdfToText(buffer)` | Convert PDF buffer to text string |
| `pdfToTextBuffer(buffer)` | Convert PDF buffer to text buffer |
| `pdfFileToText(input, output)` | Convert PDF file to text file |

### Document Functions

| Function | Description |
|----------|-------------|
| `manyToMarkdown(stream, format)` | Convert document stream to Markdown |

## Requirements

- Node.js 18+
- MuTool (for PDF conversion)
- Pandoc (for document conversion)

## License

Apache-2.0
