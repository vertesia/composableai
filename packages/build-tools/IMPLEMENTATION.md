# @vertesia/build-tools - Implementation Summary

## Overview

A generic, extensible Rollup plugin for transforming imports based on path patterns. Built with TypeScript, validated with Zod, and includes preset transformers for common use cases.

## Architecture

### Core Components

1. **Plugin Core** (`src/plugin.ts`)
   - Generic import transformer engine
   - Pattern matching via RegExp
   - File loading and transformation
   - Optional Zod validation at build time

2. **Type System** (`src/types.ts`)
   - `TransformerRule`: Configuration for a single import pattern
   - `TransformFunction`: Function signature for transformations
   - `TransformResult`: Return type with data and optional custom code

3. **Preset Transformers** (`src/presets/`)
   - **Skill Transformer**: Parses markdown with YAML frontmatter into skill definitions
   - **Raw Transformer**: Imports any file as a raw string

4. **Utilities** (`src/parsers/`)
   - Frontmatter parser using gray-matter library

## Key Features

### Generic Transformer Architecture

The plugin is designed to be extensible:

```typescript
vertesiaImportPlugin({
  transformers: [
    {
      pattern: /\.md\?skill$/,           // What to match
      schema: SkillDefinitionSchema,      // Optional Zod validation
      transform: (content, filePath) => { // How to transform
        return { data: parsedData };
      }
    }
  ]
})
```

### Build-Time Validation

Zod schemas validate transformed data during the build, not at runtime:
- Build fails with clear error messages if validation fails
- No runtime overhead
- Type-safe with `z.infer<typeof Schema>`

### TypeScript Integration

Type declarations for imports:

```typescript
// src/types/imports.d.ts
declare module '*.md?skill' {
  import type { SkillDefinition } from '@vertesia/build-tools';
  const skill: SkillDefinition;
  export default skill;
}
```

## Usage in Tool Server Template

### Configuration

`rollup.config.js`:
```typescript
import { vertesiaImportPlugin, skillTransformer, rawTransformer }
  from '@vertesia/build-tools';

plugins: [
  vertesiaImportPlugin({
    transformers: [
      skillTransformer,  // .md?skill imports
      rawTransformer     // ?raw imports
    ]
  }),
  // ... other plugins
]
```

### Example Usage

```typescript
// Import skill from markdown
import codeReview from './skills/code-review.md?skill';

console.log(codeReview.name);        // Fully typed
console.log(codeReview.title);       // TypeScript knows the structure
console.log(codeReview.content);     // Markdown content as string

// Import raw file
import template from './template.html?raw';
console.log(template); // String content
```

## Skill Transformer Details

### Input Format

Markdown file with YAML frontmatter:

```markdown
---
name: skill-name
title: Skill Title
description: What this skill does
keywords: [tag1, tag2]
custom_field: value
---

# Skill Content

The markdown content here.
```

### Output Structure

```typescript
{
  name: 'skill-name',
  title: 'Skill Title',
  description: 'What this skill does',
  keywords: ['tag1', 'tag2'],
  content: '# Skill Content\n\nThe markdown content...',
  metadata: {
    custom_field: 'value'
  }
}
```

### Validation

Required fields:
- `name`: non-empty string
- `title`: non-empty string
- `description`: non-empty string
- `content`: string (extracted markdown)

Optional fields:
- `keywords`: array of strings
- `metadata`: object with extra frontmatter fields

## Testing

Comprehensive test suite in `tests/`:
- `skill.test.ts`: Skill transformer tests
- `raw.test.ts`: Raw transformer tests
- `frontmatter.test.ts`: Frontmatter parser tests

All tests pass with 100% coverage of core functionality.

## Package Structure

```
@vertesia/build-tools/
├── src/
│   ├── index.ts              # Main exports
│   ├── plugin.ts             # Core plugin logic
│   ├── types.ts              # TypeScript interfaces
│   ├── presets/
│   │   ├── skill.ts          # Skill transformer + schema
│   │   └── raw.ts            # Raw transformer
│   └── parsers/
│       └── frontmatter.ts    # YAML frontmatter parser
├── tests/                    # Test suite
├── lib/                      # Built files (ESM + CJS)
└── README.md                 # User documentation
```

## Dependencies

- **gray-matter**: YAML frontmatter parsing
- **zod**: Runtime validation at build time
- **rollup**: Peer dependency

## Future Extensions

The generic architecture allows easy addition of new transformers:

1. **Interaction Transformer** - Parse interaction definitions from markdown
2. **Widget Transformer** - Transform widget metadata files
3. **JSON Schema Transformer** - Validate JSON files against schemas
4. **YAML Transformer** - Parse YAML configuration files
5. **Custom Transformers** - Any pattern-based transformation need

## Integration Points

### Tool Server Template
- Replaced custom `rawPlugin()` with generic `vertesiaImportPlugin`
- Added skill import support
- Type declarations for TypeScript

### Future: Other Templates
- Can be used in any Rollup-based build
- Works with both browser and server builds
- No Vertesia-specific dependencies (except optional types)

## Build System

Uses ts-dual-module for dual ESM/CJS builds:
1. `tsmod build` - Compiles TypeScript to ESM and CJS
2. `rollup -c` - Bundles ESM build for distribution

## License

Apache-2.0

## Repository

Part of the Vertesia ComposableAI monorepo:
`composableai/packages/rollup-plugin-imports`
