# @vertesia/memory-commands

Commands for building Vertesia memory packs from recipe scripts. This package provides the DSL (Domain Specific Language) used in memory recipe scripts.

## Features

- **Recipe DSL**: Simple commands for building memory packs
- **TypeScript Support**: Direct execution of TypeScript recipe files
- **File Operations**: Copy files, text, JSON, and media into memory packs
- **Document Processing**: Built-in support for PDF and DOCX conversion
- **Shell Execution**: Run shell commands during build

## Installation

```bash
npm install @vertesia/memory-commands
# or
pnpm add @vertesia/memory-commands
```

## Usage

### Writing Recipe Scripts

Recipe scripts use the exported commands to define memory pack contents:

```typescript
import { from, copy, json, content, vars } from '@vertesia/memory-commands';

// Set the base directory for file operations
from('./src');

// Copy files into the memory pack
copy('**/*.ts', { to: 'source/' });

// Add JSON data
json({ version: vars().version, name: 'my-project' }, 'metadata.json');

// Add text content directly
content('# Project Documentation\n\nThis is the main documentation.', 'docs/README.md');

export default {}; // Required default export
```

### Building Programmatically

```typescript
import { build } from '@vertesia/memory-commands';

await build('recipe.ts', {
  out: 'memory.tar',
  gzip: true,
  vars: { version: '1.0.0' }
});
```

## Available Commands

### File Operations

| Command | Description |
|---------|-------------|
| `from(path)` | Set the base directory for file operations |
| `copy(glob, options?)` | Copy files matching glob pattern |
| `copyText(glob, options?)` | Copy text files with optional transformation |
| `content(text, path)` | Add text content directly |
| `json(data, path)` | Add JSON data |

### Document Processing

| Command | Description |
|---------|-------------|
| `pdf(path, options?)` | Extract text from PDF files |
| `docx(path, options?)` | Convert DOCX files to markdown |
| `media(path, options?)` | Add media files with optional transformation |

### Utilities

| Command | Description |
|---------|-------------|
| `vars()` | Access variables passed via CLI |
| `tmpdir()` | Get a temporary directory for intermediate files |
| `exec(command)` | Execute a shell command |

## Examples

### Copy Source Code

```typescript
import { from, copy } from '@vertesia/memory-commands';

from('./src');
copy('**/*.ts', { to: 'code/' });
copy('**/*.json', { to: 'config/' });

export default {};
```

### Process Documents

```typescript
import { from, pdf, docx } from '@vertesia/memory-commands';

from('./docs');
pdf('*.pdf', { to: 'text/' });
docx('*.docx', { to: 'markdown/' });

export default {};
```

### Dynamic Content

```typescript
import { json, content, vars } from '@vertesia/memory-commands';

const config = vars();

json({
  name: config.name,
  version: config.version,
  timestamp: new Date().toISOString()
}, 'manifest.json');

content(`# ${config.name}\n\nVersion: ${config.version}`, 'README.md');

export default {};
```

## API

### build(script, options?)

Execute a recipe script to build a memory pack.

```typescript
interface BuildOptions {
  out?: string;           // Output file (default: 'memory.tar')
  gzip?: boolean;         // Compress output
  indent?: number;        // JSON indentation
  quiet?: boolean;        // Suppress output
  test?: boolean;         // Test mode (don't write files)
  vars?: Record<string, any>;  // Variables for the script
  transpileDir?: string;  // Directory for transpiled TypeScript
}
```

### getBuilder()

Get the current builder instance (for advanced use cases).

## License

Apache-2.0
