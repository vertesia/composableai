# @vertesia/memory-cli

A command-line tool for building and managing Vertesia memory packs. Memory packs are archives containing structured data for LLM context.

## Features

- **Build Memory Packs**: Create memory archives from recipe scripts
- **Export Data**: Extract JSON objects from memory packs using mappings
- **Gzip Compression**: Optionally compress output files
- **Custom Variables**: Pass variables to recipe scripts via command line

## Requirements

Node.js version 18 or higher is required.

## Installation

```bash
npm install -g @vertesia/memory-cli
# or
pnpm add -g @vertesia/memory-cli
```

## Usage

### Build a Memory Pack

Build a memory pack from a recipe script:

```bash
memo build <recipe>
```

#### Options

| Option | Description |
|--------|-------------|
| `-o, --out <file>` | Output file (default: `memory.tar`) |
| `-z, --gzip` | Compress output with gzip |
| `-i, --indent <spaces>` | JSON indentation (default: 2) |
| `-q, --quiet` | Suppress console output |
| `-t, --test` | Test recipe without building |

#### Passing Variables

Pass custom variables to your recipe script using `--var-<name>`:

```bash
memo build recipe.ts --var-version 1.0.0 --var-env production
```

Variables are available in your recipe script via the `vars` object.

### Export from Memory Pack

Export a JSON object from a memory pack using a mapping:

```bash
memo export <pack> --map <mapping>
```

#### Examples

```bash
# Export with inline JSON mapping
memo export memory.tar --map '{"title": "$.metadata.title", "content": "$.files[0].content"}'

# Export with mapping file
memo export memory.tar --map @mapping.json

# Export with custom indentation
memo export memory.tar --map @mapping.json --indent 4
```

## Recipe Scripts

Recipe scripts are TypeScript files that define how to build a memory pack. They use the `@vertesia/memory` API to collect and structure data.

Example recipe (`recipe.ts`):

```typescript
import { MemoryBuilder } from '@vertesia/memory';

const builder = new MemoryBuilder();

// Add files, metadata, and structured data
builder.addFile('README.md', readFileSync('README.md'));
builder.setMetadata({ version: vars.version });

export default builder;
```

## API

The CLI can also be used programmatically:

```typescript
import { setupMemoCommand } from '@vertesia/memory-cli';
import { Command } from 'commander';

const program = new Command();
setupMemoCommand(program);
program.parse();
```

## Documentation

See [Vertesia Documentation](https://docs.vertesiahq.com)

## License

Apache-2.0
